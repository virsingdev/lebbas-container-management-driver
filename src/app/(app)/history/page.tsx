'use client';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { api, type Row } from '@/lib/api';
import { cached } from '@/lib/cached';
import { DONE, useRoutes } from '@/lib/hooks';
import { syncNow } from '@/lib/sync';
import { useDriver } from '@/components/Providers';
import { Badge, Btn, Card, Empty, Skeleton } from '@/components/ui';

export default function History() {
  const { ops, status } = useDriver();
  const routes = useRoutes();
  const shifts = useQuery({
    queryKey: ['shifts'],
    queryFn: () => cached<Row[]>('shifts', () => api('/driver/shifts?page_size=10').then((d) => d.items)),
  });

  const queue = ops.slice().sort((a, b) => b.createdAt - a.createdAt);
  const open = queue.filter((o) => o.status !== 'synced');
  const finished = (routes.data?.data ?? [])
    .flatMap((r) => r.stops.filter((s: Row) => DONE.includes(s.status)).map((s: Row) => ({ ...s, route_code: r.route_code })))
    .sort((a, b) => String(b.completed_at ?? '').localeCompare(String(a.completed_at ?? '')));

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">History</h1>
        <button
          type="button"
          onClick={() => syncNow(true)}
          disabled={!open.length || status.net !== 'online'}
          className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-[#F0FDFA] px-3 py-1.5 text-xs font-bold text-[#0F766E] disabled:opacity-40"
        >
          <RefreshCw size={13} aria-hidden /> Sync now
        </button>
      </div>

      <section className="space-y-2.5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Sync queue</h2>
        {!queue.length ? (
          <Empty>Nothing saved on this phone.</Empty>
        ) : (
          queue.slice(0, 30).map((o) => (
            <Card key={o.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-slate-900">{o.label}</p>
                <p className="text-xs text-slate-500">
                  {format(o.createdAt, 'd MMM HH:mm')}
                  {o.attempts ? ` · tried ${o.attempts}×` : ''}
                </p>
                {o.error && <p className="mt-1 text-xs font-medium text-red-700">{o.error}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Badge>{o.status}</Badge>
                {o.status === 'failed' && (
                  <Btn className="!min-h-[36px] !w-auto !px-3 text-xs" v="ghost" onClick={() => syncNow(true)}>
                    Retry
                  </Btn>
                )}
              </div>
            </Card>
          ))
        )}
        {queue.some((o) => o.status === 'conflict') && (
          <p className="text-xs text-slate-600">
            Conflicts mean the server holds different data for that stop. Tell your supervisor; the record is kept here.
          </p>
        )}
      </section>

      <section className="space-y-2.5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Finished stops</h2>
        {routes.isLoading ? (
          <Skeleton rows={2} />
        ) : !finished.length ? (
          <Empty>No finished stops yet.</Empty>
        ) : (
          finished.map((s) => (
            <Card key={s.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-slate-900">{s.container.container_code}</p>
                <p className="text-xs text-slate-500">
                  {s.route_code}
                  {s.completed_at ? ` · ${format(new Date(s.completed_at), 'd MMM HH:mm')}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Badge>{s.status}</Badge>
                {s.collected_weight_kg && <p className="mt-1 text-xs font-bold text-slate-700">{s.collected_weight_kg} kg</p>}
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-2.5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Shifts</h2>
        {shifts.isLoading ? (
          <Skeleton rows={1} />
        ) : !shifts.data?.data.length ? (
          <Empty>No shifts yet.</Empty>
        ) : (
          shifts.data.data.map((s) => (
            <Card key={s.id} className="flex items-center justify-between text-xs font-medium text-slate-700">
              <span>
                {format(new Date(s.start_time), 'd MMM HH:mm')} → {s.end_time ? format(new Date(s.end_time), 'HH:mm') : 'now'}
              </span>
              <Badge>{s.status}</Badge>
            </Card>
          ))
        )}
      </section>
    </>
  );
}
