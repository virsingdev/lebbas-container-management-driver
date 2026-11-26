'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { LocateFixed, Radar, RefreshCw } from 'lucide-react';
import { pickRoute, summarize, useOverlay, useRoutes } from '@/lib/hooks';
import { formatDistance, useGeoPermission } from '@/lib/geo';
import { DWELL_MS, hasValidCoords } from '@/lib/geofence';
import { useGeofence } from '@/components/GeofenceMonitor';
import { Badge, Card, Empty, Skeleton } from '@/components/ui';
import type { MapStop } from '@/components/MapView';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <Skeleton rows={3} /> });
type Me = { lat: number; lng: number; acc: number; ts: number };

export default function MapPage() {
  const routes = useRoutes();
  const ov = useOverlay();
  const perm = useGeoPermission();
  const { enabled, fix: geoFix, nearby, closest, detectorState, geoError, refreshGps } = useGeofence();
  const [localMe, setLocalMe] = useState<Me | null>(null);
  const [localErr, setLocalErr] = useState('');
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Only run a separate map watch if the global geofence detector is turned off.
  useEffect(() => {
    if (enabled || typeof navigator === 'undefined' || !navigator.geolocation) return;
    let active = true;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (!active) return;
        setLocalMe({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, ts: p.timestamp });
        setLocalErr('');
      },
      (e) => {
        if (!active) return;
        setLocalErr(e.code === 1 ? 'Location permission denied. Allow it in your browser settings.' : 'Location unavailable right now.');
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => {
      active = false;
      navigator.geolocation.clearWatch(id);
    };
  }, [enabled]);

  const currentMe: Me | null = geoFix
    ? { lat: geoFix.latitude, lng: geoFix.longitude, acc: geoFix.accuracy, ts: geoFix.ts }
    : localMe;
  const err = geoError || localErr;

  const route = pickRoute(routes.data?.data);
  const sm = summarize(route, ov);
  const stops: MapStop[] = sm.stops
    .map((s) => {
      const coords = hasValidCoords(s);
      if (!coords) return null;
      return {
        id: s.id,
        routeId: route!.id,
        lat: coords.lat,
        lng: coords.lng,
        code: s.container.container_code,
        place: s.container.location_name,
        seq: s.sequence_number,
        status: sm.eff(s),
        next: sm.next?.id === s.id,
      };
    })
    .filter((x): x is MapStop => x !== null);

  async function handleRefreshGps() {
    setRefreshing(true);
    try {
      await refreshGps();
      setTick((t) => t + 1);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Route Map</h1>
        <button
          type="button"
          onClick={handleRefreshGps}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs active:bg-slate-50"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : undefined} aria-hidden />
          Refresh GPS
        </button>
      </div>

      {routes.isLoading ? (
        <Skeleton rows={2} />
      ) : !route && !currentMe ? (
        <Empty>No route assigned today and GPS is not active yet.</Empty>
      ) : route && !stops.length && !currentMe ? (
        <Empty>The stops on this route have no saved coordinates.</Empty>
      ) : (
        <div className="relative h-[52vh] min-h-[300px] overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          <MapView stops={stops} me={currentMe ? { lat: currentMe.lat, lng: currentMe.lng, acc: currentMe.acc } : null} tick={tick} />
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            disabled={!currentMe}
            aria-label="Centre on my location"
            className="absolute bottom-4 right-4 z-[1000] flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0F766E] shadow-lg active:scale-95 disabled:opacity-40"
          >
            <LocateFixed size={22} />
          </button>
        </div>
      )}

      <Card className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Radar size={17} className="text-[#0F766E]" aria-hidden />
            <span>GPS &amp; Zero-Scan Detector</span>
          </div>
          <Badge tone={detectorState === 'dwelled' || detectorState === 'scanning' || detectorState === 'approaching' ? 'ok' : detectorState === 'error' ? 'bad' : 'info'}>
            {detectorState.replace('_', ' ')}
          </Badge>
        </div>

        {err && !currentMe ? (
          <div className="space-y-2 rounded-xl bg-red-50 p-3 text-xs text-red-800">
            <p>{err}</p>
            <button
              type="button"
              onClick={handleRefreshGps}
              className="inline-flex items-center gap-1 rounded-lg bg-red-700 px-3 py-1.5 font-semibold text-white"
            >
              <LocateFixed size={13} aria-hidden /> Retry GPS
            </button>
          </div>
        ) : currentMe ? (
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">
              Accuracy ±{Math.round(currentMe.acc)} m · updated {format(currentMe.ts, 'HH:mm:ss')}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-500">
              {currentMe.lat.toFixed(5)}, {currentMe.lng.toFixed(5)}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            <span>{perm === 'denied' ? 'Location permission denied.' : 'Waiting for GPS fix…'}</span>
            <button
              type="button"
              onClick={handleRefreshGps}
              className="rounded-lg bg-amber-600 px-2.5 py-1 font-semibold text-white"
            >
              Allow GPS
            </button>
          </div>
        )}

        {nearby ? (
          <div className="rounded-xl border border-teal-200 bg-[#F0FDFA] p-3 text-xs text-[#134E4A]">
            <p className="font-bold">
              Inside geofence: {nearby.containerCode} ({formatDistance(nearby.distanceM)})
            </p>
            <p className="mt-0.5">
              {nearby.dwelled
                ? 'Arrival verified — ready to confirm pickup.'
                : `Verifying dwell (${Math.round(nearby.dwellMs / 1000)}s / ${Math.round(DWELL_MS / 1000)}s)…`}
            </p>
          </div>
        ) : closest ? (
          <p className="text-xs font-medium text-slate-600">
            Nearest open stop: <span className="font-bold text-slate-900">{closest.containerCode}</span> ({formatDistance(closest.distanceM)} away)
          </p>
        ) : null}

        <p className="text-[11px] leading-relaxed text-slate-500">
          Dashed teal circles show the 65 m zero-scan detection zone around open stops. Keep the app open while driving; browsers pause GPS if the screen is locked.
        </p>
      </Card>
    </>
  );
}
