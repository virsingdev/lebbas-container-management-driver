'use client';
import Link from 'next/link';
import { format } from 'date-fns';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight } from 'lucide-react';
import { api, errMsg, type Row } from '@/lib/api';
import { summarize, useOverlay, useRoutes } from '@/lib/hooks';
import { useDriver } from '@/components/Providers';
import { Badge, Btn, Card, Empty, ErrorBox, Sheet, Skeleton } from '@/components/ui';

export default function MyRoute() {
  const { status } = useDriver();
  const qc = useQueryClient();
  const routes = useRoutes(); const ov = useOverlay();
  const [confirm, setConfirm] = useState<Row | null>(null);
  const act = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: 'start' | 'complete' }) => api(`/driver/routes/${id}/${kind}`, { method: 'POST' }),
    onSuccess: (_d, v) => { toast.success(v.kind === 'start' ? 'Route started' : 'Route completed'); setConfirm(null); qc.invalidateQueries({ queryKey: ['routes'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const list = routes.data?.data ?? [];
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">My Route</h1>
      {routes.data?.stale && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Saved copy from {format(routes.data.savedAt, 'HH:mm')}. Pending changes are shown on top.</p>}
      {routes.isLoading ? <Skeleton /> : routes.error ? <ErrorBox error={routes.error} retry={() => routes.refetch()} /> : !list.length ? <Empty>No routes assigned.</Empty> : list.map((r) => {
        const sm = summarize(r, ov);
        return (
          <Card key={r.id} className="space-y-3">
            <div className="flex items-start justify-between"><div><h2 className="text-lg font-bold">{r.route_code}</h2><p className="text-sm text-slate-500">{format(new Date(r.route_date), 'EEE d MMM')}{r.vehicle ? ` · ${r.vehicle.plate_number}` : ''}</p></div><Badge>{r.status}</Badge></div>
            <p className="text-sm text-slate-600">{sm.closed} of {sm.total} stops finished</p>
            <ol className="space-y-2">
              {sm.stops.map((s) => { const e = sm.eff(s); const pend = ov.get(s.id);
                return <li key={s.id}><Link href={`/stop?r=${r.id}&s=${s.id}`} className="flex min-h-[64px] items-center gap-3 rounded-xl border border-slate-200 p-3 active:bg-slate-50">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F0FDFA] font-bold text-[#0F766E]">{s.sequence_number}</span>
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{s.container.container_code}</span><span className="block truncate text-sm text-slate-500">{s.container.location_name}</span></span>
                  <span className="flex flex-col items-end gap-1"><Badge>{e}</Badge>{pend && <span className="text-[10px] font-semibold text-amber-700">pending sync</span>}</span><ChevronRight size={18} className="text-slate-400" /></Link></li>; })}
            </ol>
            {(r.status === 'assigned' || r.status === 'planned') && <Btn disabled={act.isPending || status.net !== 'online'} onClick={() => act.mutate({ id: r.id, kind: 'start' })}>Start route</Btn>}
            {r.status === 'in_progress' && <Btn v="ghost" disabled={act.isPending || status.net !== 'online'} onClick={() => setConfirm(r)}>Complete route</Btn>}
          </Card>);
      })}
      {confirm && <Sheet title={`Complete ${confirm.route_code}?`} onClose={() => setConfirm(null)}><p className="mb-4 text-slate-600">All stops must be finished and synced. The server will refuse if any stop is still open.</p><div className="space-y-3"><Btn disabled={act.isPending} onClick={() => act.mutate({ id: confirm.id, kind: 'complete' })}>Complete route</Btn><Btn v="ghost" onClick={() => setConfirm(null)}>Cancel</Btn></div></Sheet>}
    </>
  );
}
