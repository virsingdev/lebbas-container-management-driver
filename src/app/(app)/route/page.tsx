'use client';
import Link from 'next/link';
import { format } from 'date-fns';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ChevronRight, MapPin, RefreshCw } from 'lucide-react';
import { api, errMsg, type Row } from '@/lib/api';
import { distanceMeters, formatDistance } from '@/lib/geo';
import { hasValidCoords } from '@/lib/geofence';
import { DONE, summarize, useOverlay, useRoutes } from '@/lib/hooks';
import { useGeofence } from '@/components/GeofenceMonitor';
import { useDriver } from '@/components/Providers';
import { Badge, Btn, Card, Empty, ErrorBox, Sheet, Skeleton, cn } from '@/components/ui';

export default function MyRoute() {
  const { status } = useDriver();
  const qc = useQueryClient();
  const routes = useRoutes();
  const ov = useOverlay();
  const { fix, nearby } = useGeofence();
  const [confirm, setConfirm] = useState<Row | null>(null);

  const act = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: 'start' | 'complete' }) =>
      api(`/driver/routes/${id}/${kind}`, { method: 'POST' }),
    onSuccess: (_d, v) => {
      toast.success(v.kind === 'start' ? 'Route started' : 'Route completed');
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const list = routes.data?.data ?? [];

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My Route</h1>
        <button
          type="button"
          onClick={() => void routes.refetch()}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs active:bg-slate-50"
        >
          <RefreshCw size={13} className={routes.isFetching ? 'animate-spin' : undefined} aria-hidden />
          Refresh
        </button>
      </div>

      {routes.data?.stale && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
          Saved copy from {format(routes.data.savedAt, 'HH:mm')}. Pending changes are shown on top.
        </p>
      )}

      {routes.isLoading ? (
        <Skeleton />
      ) : routes.error ? (
        <ErrorBox error={routes.error} retry={() => routes.refetch()} />
      ) : !list.length ? (
        <Empty
          action={
            <button
              type="button"
              onClick={() => void routes.refetch()}
              className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700"
            >
              <RefreshCw size={13} aria-hidden /> Check again
            </button>
          }
        >
          No routes assigned right now.
        </Empty>
      ) : (
        list.map((r) => {
          const sm = summarize(r, ov);
          return (
            <Card key={r.id} className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">{r.route_code}</h2>
                  <p className="text-xs font-medium text-slate-500">
                    {format(new Date(r.route_date), 'EEE d MMM')}
                    {r.vehicle ? ` · ${r.vehicle.plate_number}` : ''}
                  </p>
                </div>
                <Badge>{r.status}</Badge>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
                  <span>Progress</span>
                  <span>
                    {sm.closed} of {sm.total} stops finished
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#0F766E] transition-all"
                    style={{ width: `${sm.total ? (sm.closed / sm.total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <ol className="space-y-2">
                {sm.stops.map((s) => {
                  const e = sm.eff(s);
                  const pend = ov.get(s.id);
                  const isDone = DONE.includes(e);
                  const isNext = sm.next?.id === s.id;
                  const inGeo = nearby?.stopId === s.id;
                  const coords = hasValidCoords(s);
                  const dist =
                    fix && coords ? distanceMeters(fix.latitude, fix.longitude, coords.lat, coords.lng) : null;

                  return (
                    <li key={s.id}>
                      <Link
                        href={`/stop?r=${r.id}&s=${s.id}`}
                        className={cn(
                          'flex min-h-[68px] items-center gap-3 rounded-2xl border p-3 transition active:scale-[0.99]',
                          inGeo
                            ? 'border-[#0F766E] bg-[#F0FDFA]'
                            : isNext
                              ? 'border-teal-200 bg-teal-50/30'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                            isDone
                              ? 'bg-emerald-100 text-emerald-700'
                              : inGeo || isNext
                                ? 'bg-[#0F766E] text-white'
                                : 'bg-slate-100 text-slate-700'
                          )}
                        >
                          {isDone ? <Check size={16} aria-hidden /> : s.sequence_number}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{s.container.container_code}</span>
                            {inGeo && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-[#0F766E] px-2 py-0.5 text-[10px] font-bold text-white">
                                <MapPin size={10} aria-hidden /> Nearby
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-xs text-slate-500">{s.container.location_name}</span>
                          {dist !== null && !isDone && (
                            <span className="mt-0.5 block text-[11px] font-semibold text-[#0F766E]">
                              {formatDistance(dist)} away
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <Badge>{e}</Badge>
                          {pend && <span className="text-[10px] font-semibold text-amber-700">pending sync</span>}
                        </span>
                        <ChevronRight size={17} className="shrink-0 text-slate-400" />
                      </Link>
                    </li>
                  );
                })}
              </ol>

              {(r.status === 'assigned' || r.status === 'planned') && (
                <Btn
                  disabled={act.isPending || status.net !== 'online'}
                  onClick={() => act.mutate({ id: r.id, kind: 'start' })}
                >
                  Start route
                </Btn>
              )}
              {r.status === 'in_progress' && (
                <Btn
                  v="ghost"
                  disabled={act.isPending || status.net !== 'online'}
                  onClick={() => setConfirm(r)}
                >
                  Complete route
                </Btn>
              )}
            </Card>
          );
        })
      )}

      {confirm && (
        <Sheet title={`Complete ${confirm.route_code}?`} onClose={() => setConfirm(null)}>
          <p className="mb-4 text-sm text-slate-600">
            All stops must be finished and synced. The server will refuse if any stop is still open.
          </p>
          <div className="space-y-3">
            <Btn disabled={act.isPending} onClick={() => act.mutate({ id: confirm.id, kind: 'complete' })}>
              Complete route
            </Btn>
            <Btn v="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Btn>
          </div>
        </Sheet>
      )}
    </>
  );
}
