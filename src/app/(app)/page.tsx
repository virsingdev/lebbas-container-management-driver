'use client';
import Link from 'next/link';
import { format } from 'date-fns';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ChevronRight, Map, QrCode, RefreshCw, Route as RouteIcon } from 'lucide-react';
import { api, errMsg, type Row } from '@/lib/api';
import { cached } from '@/lib/cached';
import { getFix } from '@/lib/geo';
import { pickRoute, summarize, useOverlay, useRoutes } from '@/lib/hooks';
import { syncNow } from '@/lib/sync';
import { useDriver } from '@/components/Providers';
import { Badge, Btn, Card, ErrorBox, Sheet, Skeleton } from '@/components/ui';

export default function Home() {
  const { driver, status } = useDriver();
  const qc = useQueryClient();
  const routes = useRoutes(); const ov = useOverlay();
  const shift = useQuery({ queryKey: ['shift'], queryFn: () => cached<Row | null>('shift', () => api<Row | null>('/driver/shifts/current').then((d) => d ?? null)) });
  const [endOpen, setEndOpen] = useState(false);
  const route = pickRoute(routes.data?.data); const sm = summarize(route, ov);
  const cur = shift.data?.data;
  const act = useMutation({
    mutationFn: async (kind: 'start' | 'end') => {
      const f = await getFix(5000);
      const k = kind === 'start' ? 'start' : 'end';
      return api(`/driver/shifts/${kind}`, { method: 'POST', body: { [`${k}_latitude`]: f?.latitude ?? null, [`${k}_longitude`]: f?.longitude ?? null } });
    },
    onSuccess: (_d, k) => { toast.success(k === 'start' ? 'Shift started' : 'Shift ended'); setEndOpen(false); qc.invalidateQueries({ queryKey: ['shift'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const stale = routes.data?.stale || shift.data?.stale;
  return (
    <>
      <div><h1 className="text-2xl font-bold tracking-tight">Hello, driver {driver.employee_code}</h1><p className="text-slate-500">{format(new Date(), 'EEEE, d MMMM')}</p></div>
      {stale && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Showing data saved on this phone{routes.data ? ` (${format(routes.data.savedAt, 'HH:mm')})` : ''}. It refreshes when you are back online.</p>}
      <Card>
        <div className="flex items-center justify-between"><h2 className="font-semibold">Shift</h2>{shift.isLoading ? null : <Badge tone={cur ? 'ok' : 'neutral'}>{cur ? 'On duty' : 'Off duty'}</Badge>}</div>
        {cur && <p className="mt-1 text-sm text-slate-500">Started {format(new Date(cur.start_time), 'HH:mm')}</p>}
        <Btn className="mt-3" v={cur ? 'ghost' : 'primary'} disabled={shift.isLoading || act.isPending || status.net !== 'online'} onClick={() => (cur ? setEndOpen(true) : act.mutate('start'))}>{act.isPending ? 'Please wait…' : cur ? 'End shift' : 'Start shift'}</Btn>
        {status.net !== 'online' && <p className="mt-2 text-xs text-slate-500">Starting and ending a shift needs a connection.</p>}
      </Card>
      {routes.isLoading ? <Skeleton rows={2} /> : routes.error ? <ErrorBox error={routes.error} retry={() => routes.refetch()} /> : !route ? <Card><p className="text-slate-600">No route is assigned to you today.</p></Card> : (
        <Card>
          <div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">Today&apos;s route</p><h2 className="text-xl font-bold">{route.route_code}</h2>{route.vehicle && <p className="text-sm text-slate-600">{route.vehicle.plate_number} · {route.vehicle.vehicle_type}</p>}</div><Badge>{route.status}</Badge></div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={sm.total} aria-valuenow={sm.closed}><div className="h-full bg-[#0F766E]" style={{ width: `${sm.total ? (sm.closed / sm.total) * 100 : 0}%` }} /></div>
          <div className="mt-3 grid grid-cols-3 text-center"><div><div className="text-2xl font-bold">{sm.total}</div><div className="text-xs text-slate-500">Stops</div></div><div><div className="text-2xl font-bold text-emerald-700">{sm.done}</div><div className="text-xs text-slate-500">Collected</div></div><div><div className="text-2xl font-bold text-amber-700">{sm.pending}</div><div className="text-xs text-slate-500">Left</div></div></div>
          {sm.next && <Link href={`/stop?r=${route.id}&s=${sm.next.id}`} className="mt-4 flex items-center justify-between rounded-xl bg-[#F0FDFA] p-4"><div><p className="text-xs font-semibold uppercase text-[#0F766E]">Next container</p><p className="text-lg font-bold">{sm.next.container.container_code}</p><p className="text-sm text-slate-600">{sm.next.container.location_name}</p></div><ChevronRight /></Link>}
        </Card>)}
      <div className="grid grid-cols-2 gap-3">
        {[{ h: '/route', l: 'View route', i: RouteIcon }, { h: '/map', l: 'Open map', i: Map }, { h: '/incidents', l: 'Report incident', i: AlertTriangle }, { h: '/scan', l: 'Scan container', i: QrCode }].map((a) => (
          <Link key={a.h} href={a.h} className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-semibold shadow-sm active:bg-slate-100"><a.i className="text-[#0F766E]" aria-hidden />{a.l}</Link>))}
      </div>
      {status.pending + status.attention > 0 && <Btn v="ghost" onClick={() => syncNow(true)}><RefreshCw size={18} aria-hidden /> Sync now ({status.pending + status.attention})</Btn>}
      {endOpen && <Sheet title="End your shift?" onClose={() => setEndOpen(false)}><p className="mb-4 text-slate-600">Make sure your collections are saved. Unsynced records stay on this phone.</p><div className="space-y-3"><Btn disabled={act.isPending} onClick={() => act.mutate('end')}>Yes, end shift</Btn><Btn v="ghost" onClick={() => setEndOpen(false)}>Cancel</Btn></div></Sheet>}
    </>
  );
}
