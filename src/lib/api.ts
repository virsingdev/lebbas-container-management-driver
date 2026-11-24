export type Row = Record<string, any>;
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

export async function api<T = any>(path: string, o: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const r = await fetch('/api/proxy' + path, {
    method: o.method ?? 'GET', cache: 'no-store', signal: o.signal,
    headers: o.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
  });
  if (r.status === 401 && typeof window !== 'undefined' && !location.pathname.startsWith('/login')) location.href = '/login?expired=1';
  if (!r.ok) {
    let m = `Request failed (${r.status})`;
    try {
      const d = (await r.json()).detail;
      if (typeof d === 'string') m = d;
      else if (Array.isArray(d)) m = d.map((x: any) => `${(x.loc ?? []).slice(1).join('.')}: ${x.msg}`).join('; ');
    } catch { /* keep default */ }
    throw new ApiError(m, r.status);
  }
  return (r.status === 204 ? undefined : await r.json()) as T;
}
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');
export const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16)));
