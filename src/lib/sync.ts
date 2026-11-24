import { api, ApiError, uid, type Row } from './api';
import { db, type Op } from './db';

let hooks = { driverId: '', onSynced: () => {} };
export const setSyncHooks = (h: typeof hooks) => { hooks = h; };
let running = false;

export async function enqueue(o: Pick<Op, 'type' | 'label' | 'payload' | 'routeId' | 'stopId'> & { id?: string }) {
  const op: Op = { ...o, id: o.id ?? uid(), driverId: hooks.driverId, createdAt: Date.now(), status: 'pending', attempts: 0 };
  await db.ops.add(op); // durable first; nothing is reported as synced until the API confirms
  void syncNow();
  return op;
}

// Sends queued operations to POST /driver/sync. Each operation succeeds or fails independently on the server.
export async function syncNow(includeFailed = false) {
  if (running || !hooks.driverId) return;
  running = true;
  try {
    const all = await db.ops.where('driverId').equals(hooks.driverId).toArray();
    const batch = all.filter((o) => o.status === 'pending' || (includeFailed && o.status === 'failed')).sort((a, b) => a.createdAt - b.createdAt).slice(0, 100);
    if (!batch.length) return;
    await db.ops.bulkPut(batch.map((o) => ({ ...o, status: 'syncing' as const, attempts: o.attempts + 1 })));
    try {
      const res = await api<{ operations: Row[] }>('/driver/sync', { method: 'POST', body: { operations: batch.map((o) => ({ operation_id: o.id, operation_type: o.type, route_id: o.routeId ?? null, stop_id: o.stopId ?? null, payload: o.payload })) } });
      const seen = new Set<string>();
      for (const r of res.operations) {
        seen.add(r.operation_id);
        const msg = r.error_message ?? r.error_code ?? undefined;
        const patch = r.status === 'succeeded' ? { status: 'synced' as const, syncedAt: Date.now(), error: undefined }
          : r.status === 'conflict' ? { status: 'conflict' as const, error: msg ?? 'Conflict with server data' }
          : r.status === 'failed' ? { status: 'failed' as const, error: msg ?? 'Rejected by server' }
          : { status: 'pending' as const };
        await db.ops.update(r.operation_id, patch);
      }
      for (const o of batch) if (!seen.has(o.id)) await db.ops.update(o.id, { status: 'pending' });
      hooks.onSynced();
    } catch (e) {
      // 4xx (other than auth) means the batch itself was rejected: keep it for review. Network/5xx: retry later.
      const rejected = e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401;
      await db.ops.bulkPut(batch.map((o) => ({ ...o, status: rejected ? ('failed' as const) : ('pending' as const), error: rejected ? (e as Error).message : undefined })));
    }
  } finally { running = false; }
}
