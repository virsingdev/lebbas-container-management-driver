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
  const shifts = useQuery({ queryKey: ['shifts'], queryFn: () => cached<Row[]>('shifts', () => api('/driver/shifts?page_size=10').then((d) => d.items)) });
  const queue = ops.slice().sort((a, b) => b.createdAt - a.createdAt);
  const open = queue.filter((o) => o.status !== 'synced');
  const finished = (routes.data?.data ?? []).flatMap((r) => r.stops.filter((s: Row) => DONE.includes(s.status)).map((s: Row) => ({ ...s, route_code: r.route_code })))
    .sort((a, b) => String(b.completed_at ?? '').localeCompare(String(a.completed_at ?? '')));
  return (
    <>
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold tracking-tight">History</h1>
        <button onClick={() => syncNow(true)} disabled={!open.length || status.net !== 'online'} className="flex items-center gap-1 rounded-full bg-[#F0FDFA] px-3 py-2 text-sm font-semibold text-[#0F766E] disabled:opacity-40"><RefreshCw size={16} aria-hidden /> Sync now</button></div>
      <section className="space-y-2"><h2 className="font-semibold">Sync queue</h2>
        {!queue.length ? <Empty>Nothing saved on this phone.</Empty> : queue.slice(0, 30).map((o) => (
          <Card key={o.id} className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{o.label}</p><p className="text-xs text-slate-500">{format(o.createdAt, 'd MMM HH:mm')}{o.attempts ? ` · tried ${o.attempts}×` : ''}</p>{o.error && <p className="mt-1 text-sm text-red-700">{o.error}</p>}</div>
            <div className="flex shrink-0 flex-col items-end gap-2"><Badge>{o.status === 'failed' || o.status === 'conflict' ? o.status : o.status}</Badge>{o.status === 'failed' && <Btn className="!min-h-[40px] !w-auto !px-3 text-sm" v="ghost" onClick={() => syncNow(true)}>Retry</Btn>}</div></Card>))}
        {queue.some((o) => o.status === 'conflict') && <p className="text-sm text-slate-600">Conflicts mean the server holds different data for that stop. Tell your supervisor; the record is kept here.</p>}
      </section>
      <section className="space-y-2"><h2 className="font-semibold">Finished stops</h2>
        {routes.isLoading ? <Skeleton rows={2} /> : !finished.length ? <Empty>No finished stops yet.</Empty> : finished.map((s) => (
          <Card key={s.id} className="flex items-center justify-between"><div><p className="font-semibold">{s.container.container_code}</p><p className="text-xs text-slate-500">{s.route_code}{s.completed_at ? ` · ${format(new Date(s.completed_at), 'd MMM HH:mm')}` : ''}</p></div><div className="text-right"><Badge>{s.status}</Badge>{s.collected_weight_kg && <p className="mt-1 text-sm font-semibold">{s.collected_weight_kg} kg</p>}</div></Card>))}
      </section>
      <section className="space-y-2"><h2 className="font-semibold">Shifts</h2>
        {shifts.isLoading ? <Skeleton rows={1} /> : !shifts.data?.data.length ? <Empty>No shifts yet.</Empty> : shifts.data.data.map((s) => (
          <Card key={s.id} className="flex items-center justify-between text-sm"><span>{format(new Date(s.start_time), 'd MMM HH:mm')} → {s.end_time ? format(new Date(s.end_time), 'HH:mm') : 'now'}</span><Badge>{s.status}</Badge></Card>))}
      </section>
    </>
  );
}
