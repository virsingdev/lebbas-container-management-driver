'use client';
import Link from 'next/link';
import { format } from 'date-fns';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  LocateFixed,
  Map as MapIcon,
  Navigation,
  QrCode,
  Radar,
  RefreshCw,
  Route as RouteIcon,
  Truck,
} from 'lucide-react';
import { api, errMsg, type Row } from '@/lib/api';
import { cached } from '@/lib/cached';
import { distanceMeters, formatDistance, getFix } from '@/lib/geo';
import { hasValidCoords } from '@/lib/geofence';
import { pickRoute, summarize, useOverlay, useRoutes } from '@/lib/hooks';
import { syncNow } from '@/lib/sync';
import { useGeofence } from '@/components/GeofenceMonitor';
import { useDriver } from '@/components/Providers';
import { Badge, Btn, Card, ErrorBox, Sheet, Skeleton, cn } from '@/components/ui';

export default function Home() {
  const { driver, status } = useDriver();
  const qc = useQueryClient();
  const routes = useRoutes();
  const ov = useOverlay();
  const { fix, nearby, closest, detectorState, refreshGps } = useGeofence();
  const shift = useQuery({
    queryKey: ['shift'],
    queryFn: () => cached<Row | null>('shift', () => api<Row | null>('/driver/shifts/current').then((d) => d ?? null)),
  });
  const [endOpen, setEndOpen] = useState(false);

  const route = pickRoute(routes.data?.data);
  const sm = summarize(route, ov);
  const cur = shift.data?.data;

  const act = useMutation({
    mutationFn: async (kind: 'start' | 'end') => {
      const f = fix ?? (await getFix(5000));
      const k = kind === 'start' ? 'start' : 'end';
      return api(`/driver/shifts/${kind}`, {
        method: 'POST',
        body: { [`${k}_latitude`]: f?.latitude ?? null, [`${k}_longitude`]: f?.longitude ?? null },
      });
    },
    onSuccess: (_d, k) => {
      toast.success(k === 'start' ? 'Shift started' : 'Shift ended');
      setEndOpen(false);
      qc.invalidateQueries({ queryKey: ['shift'] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const stale = routes.data?.stale || shift.data?.stale;
  const pct = sm.total ? Math.round((sm.closed / sm.total) * 100) : 0;

  const nextCoords = sm.next ? hasValidCoords(sm.next) : null;
  const nextDist = fix && nextCoords ? distanceMeters(fix.latitude, fix.longitude, nextCoords.lat, nextCoords.lng) : null;
  const nextNav = sm.next
    ? nextCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${nextCoords.lat},${nextCoords.lng}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sm.next.container.address ?? sm.next.container.location_name)}`
    : null;

  return (
    <>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0F766E]">
            {format(new Date(), 'EEEE, d MMMM')}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Driver {driver.employee_code}
          </h1>
        </div>
        {route?.vehicle && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-xs">
            <Truck size={14} className="text-[#0F766E]" aria-hidden />
            {route.vehicle.plate_number}
          </span>
        )}
      </div>

      {stale && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
          Showing offline copy{routes.data ? ` saved at ${format(routes.data.savedAt, 'HH:mm')}` : ''}. Data refreshes automatically online.
        </p>
      )}

      <Card className="space-y-3 border-slate-200/90 bg-gradient-to-br from-white to-slate-50/70">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl',
                cur ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              )}
            >
              <Clock size={20} aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Shift Status</h2>
              <p className="text-xs text-slate-500">
                {cur ? `Started at ${format(new Date(cur.start_time), 'HH:mm')}` : 'Tap below when ready to start'}
              </p>
            </div>
          </div>
          {!shift.isLoading && <Badge tone={cur ? 'ok' : 'neutral'}>{cur ? 'On duty' : 'Off duty'}</Badge>}
        </div>

        <Btn
          v={cur ? 'ghost' : 'primary'}
          disabled={shift.isLoading || act.isPending || status.net !== 'online'}
          onClick={() => (cur ? setEndOpen(true) : act.mutate('start'))}
        >
          {act.isPending ? 'Please wait…' : cur ? 'End shift' : 'Start shift'}
        </Btn>
        {status.net !== 'online' && (
          <p className="text-xs text-slate-500">Starting and ending a shift requires an internet connection.</p>
        )}
      </Card>

      {/* Live Zero-Scan Detector Strip */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-teal-200/80 bg-[#F0FDFA] px-3.5 py-2.5 text-xs">
        <div className="flex min-w-0 items-center gap-2.5">
          <Radar
            size={18}
            className={cn(
              'shrink-0 text-[#0F766E]',
              (detectorState === 'scanning' || detectorState === 'approaching' || detectorState === 'dwelled') &&
                'animate-pulse'
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="font-bold text-[#134E4A]">
              {detectorState === 'off'
                ? 'Zero-scan detector paused'
                : detectorState === 'dwelled' && nearby
                  ? `Arrived near ${nearby.containerCode}`
                  : detectorState === 'approaching' && nearby
                    ? `Approaching ${nearby.containerCode} · ${formatDistance(nearby.distanceM)}`
                    : detectorState === 'scanning' && closest
                      ? `Zero-scan active · Nearest ${closest.containerCode} (${formatDistance(closest.distanceM)})`
                      : detectorState === 'no_route'
                        ? 'Zero-scan standby · Waiting for route'
                        : detectorState === 'no_coords'
                          ? 'Stops have no GPS coordinates'
                          : detectorState === 'error'
                            ? 'GPS permission needed'
                            : 'Acquiring GPS signal…'}
            </p>
            {fix && (
              <p className="truncate text-[11px] text-[#0F766E]/80">
                GPS ±{Math.round(fix.accuracy)} m · auto-detects within 65 m
              </p>
            )}
          </div>
        </div>
        {detectorState === 'waiting_gps' || detectorState === 'error' ? (
          <button
            type="button"
            onClick={() => void refreshGps()}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#0F766E] px-2.5 py-1.5 text-[11px] font-bold text-white active:bg-[#134E4A]"
          >
            <LocateFixed size={12} aria-hidden /> Allow GPS
          </button>
        ) : (
          <Link href="/profile" className="shrink-0 font-bold text-[#0F766E] underline-offset-2 hover:underline">
            Settings
          </Link>
        )}
      </div>

      {routes.isLoading ? (
        <Skeleton rows={2} />
      ) : routes.error ? (
        <ErrorBox error={routes.error} retry={() => routes.refetch()} />
      ) : !route ? (
        <Card className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <RouteIcon size={24} aria-hidden />
          </span>
          <div>
            <p className="font-bold text-slate-800">No route assigned today</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Your route will appear here as soon as dispatch assigns it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void routes.refetch()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} className={routes.isFetching ? 'animate-spin' : undefined} aria-hidden />
            Check for route
          </button>
        </Card>
      ) : (
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Today&apos;s route</p>
              <h2 className="text-xl font-extrabold text-slate-900">{route.route_code}</h2>
            </div>
            <Badge>{route.status}</Badge>
          </div>

          <div>
            <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-600">
              <span>{pct}% complete</span>
              <span>
                {sm.closed} / {sm.total} stops
              </span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={sm.total}
              aria-valuenow={sm.closed}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0F766E] to-[#14B8A6] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 py-2.5">
              <div className="text-xl font-extrabold text-slate-900">{sm.total}</div>
              <div className="text-[11px] font-medium text-slate-500">Total</div>
            </div>
            <div className="rounded-xl bg-emerald-50/70 py-2.5">
              <div className="text-xl font-extrabold text-emerald-700">{sm.done}</div>
              <div className="text-[11px] font-medium text-emerald-700/80">Collected</div>
            </div>
            <div className="rounded-xl bg-amber-50/70 py-2.5">
              <div className="text-xl font-extrabold text-amber-700">{sm.pending}</div>
              <div className="text-[11px] font-medium text-amber-700/80">Remaining</div>
            </div>
          </div>

          {sm.next && (
            <div className="rounded-2xl border border-teal-200 bg-[#F0FDFA] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">Next stop</p>
                  <p className="text-lg font-extrabold text-slate-900">{sm.next.container.container_code}</p>
                  <p className="truncate text-sm text-slate-600">{sm.next.container.location_name}</p>
                </div>
                {nextDist !== null && (
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#0F766E] shadow-xs">
                    {formatDistance(nextDist)}
                  </span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {nextNav && (
                  <a
                    href={nextNav}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-teal-300 bg-white text-xs font-bold text-[#0F766E] active:bg-teal-50"
                  >
                    <Navigation size={15} aria-hidden /> Navigate
                  </a>
                )}
                <Link
                  href={`/stop?r=${route.id}&s=${sm.next.id}`}
                  className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl bg-[#0F766E] text-xs font-bold text-white active:bg-[#134E4A]"
                >
                  Open stop <ChevronRight size={15} aria-hidden />
                </Link>
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        {[
          { h: '/route', l: 'My Route', sub: 'Stops & progress', i: RouteIcon, bg: 'bg-teal-50 text-[#0F766E]' },
          { h: '/map', l: 'Route Map', sub: 'Live GPS & zones', i: MapIcon, bg: 'bg-sky-50 text-sky-700' },
          { h: '/incidents', l: 'Incident', sub: 'Report an issue', i: AlertTriangle, bg: 'bg-amber-50 text-amber-700' },
          { h: '/scan', l: 'QR Lookup', sub: 'Manual scan', i: QrCode, bg: 'bg-emerald-50 text-emerald-700' },
        ].map((a) => (
          <Link
            key={a.h}
            href={a.h}
            className="flex min-h-[92px] flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm transition active:scale-[0.98] active:bg-slate-50"
          >
            <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', a.bg)}>
              <a.i size={19} aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">{a.l}</p>
              <p className="text-[11px] text-slate-500">{a.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {status.pending + status.attention > 0 && (
        <Btn v="ghost" onClick={() => syncNow(true)}>
          <RefreshCw size={18} aria-hidden /> Sync pending updates ({status.pending + status.attention})
        </Btn>
      )}

      {endOpen && (
        <Sheet title="End your shift?" onClose={() => setEndOpen(false)}>
          <p className="mb-4 text-sm text-slate-600">
            Make sure your collections are saved. Any pending offline records stay safely stored on this phone.
          </p>
          <div className="space-y-3">
            <Btn disabled={act.isPending} onClick={() => act.mutate('end')}>
              Yes, end shift
            </Btn>
            <Btn v="ghost" onClick={() => setEndOpen(false)}>
              Cancel
            </Btn>
          </div>
        </Sheet>
      )}
    </>
  );
}
