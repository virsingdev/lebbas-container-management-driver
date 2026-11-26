'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { LocateFixed } from 'lucide-react';
import { pickRoute, summarize, useOverlay, useRoutes } from '@/lib/hooks';
import { useGeoPermission } from '@/lib/geo';
import { useGeofence } from '@/components/GeofenceMonitor';
import { Card, Empty, Skeleton } from '@/components/ui';
import type { MapStop } from '@/components/MapView';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <Skeleton rows={3} /> });
type Me = { lat: number; lng: number; acc: number; ts: number };

export default function MapPage() {
  const routes = useRoutes();
  const ov = useOverlay();
  const perm = useGeoPermission();
  const { fix: geoFix, nearby } = useGeofence();
  const [me, setMe] = useState<Me | null>(null);
  const [gErr, setGErr] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    if (!navigator.geolocation) {
      Promise.resolve().then(() => { if (active) setGErr('This device does not support location.'); });
      return () => { active = false; };
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (!active) return;
        setMe({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, ts: p.timestamp });
        setGErr('');
      },
      (e) => {
        if (!active) return;
        setGErr(e.code === 1 ? 'Location permission denied. Allow it in your browser settings.' : 'Location unavailable right now.');
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => {
      active = false;
      navigator.geolocation.clearWatch(id);
    };
  }, []);

  const currentMe: Me | null = me ?? (geoFix ? { lat: geoFix.latitude, lng: geoFix.longitude, acc: geoFix.accuracy, ts: geoFix.ts } : null);
  const route = pickRoute(routes.data?.data);
  const sm = summarize(route, ov);
  const stops: MapStop[] = sm.stops
    .filter((s) => s.container.latitude && s.container.longitude)
    .map((s) => ({
      id: s.id,
      routeId: route!.id,
      lat: Number(s.container.latitude),
      lng: Number(s.container.longitude),
      code: s.container.container_code,
      place: s.container.location_name,
      seq: s.sequence_number,
      status: sm.eff(s),
      next: sm.next?.id === s.id,
    }));

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Map</h1>
      {routes.isLoading ? (
        <Skeleton rows={2} />
      ) : !route ? (
        <Empty>No route for today.</Empty>
      ) : !stops.length ? (
        <Empty>The stops on this route have no saved coordinates.</Empty>
      ) : (
        <div className="relative h-[55vh] overflow-hidden rounded-2xl border border-slate-200">
          <MapView stops={stops} me={currentMe ? { lat: currentMe.lat, lng: currentMe.lng, acc: currentMe.acc } : null} tick={tick} />
          <button
            onClick={() => setTick((t) => t + 1)}
            disabled={!currentMe}
            aria-label="Centre on my location"
            className="absolute bottom-4 right-4 z-[1000] rounded-full bg-white p-4 shadow-lg disabled:opacity-40"
          >
            <LocateFixed className="text-[#0F766E]" />
          </button>
        </div>
      )}
      <Card className="space-y-1 text-sm">
        <p className="font-semibold">GPS</p>
        {gErr ? (
          <p className="text-red-700">{gErr}</p>
        ) : currentMe ? (
          <p className="text-slate-600">
            ±{Math.round(currentMe.acc)} m accuracy · updated {format(currentMe.ts, 'HH:mm:ss')}
            <br />
            {currentMe.lat.toFixed(5)}, {currentMe.lng.toFixed(5)}
          </p>
        ) : (
          <p className="text-slate-500">{perm === 'denied' ? 'Permission denied.' : 'Waiting for location…'}</p>
        )}
        {nearby && (
          <p className="text-xs font-semibold text-[#0F766E]">
            In geofence: {nearby.containerCode} ({Math.round(nearby.distanceM)} m{nearby.dwelled ? ' · dwelled' : ' · detecting…'})
          </p>
        )}
        <p className="text-xs text-slate-500">
          Foreground GPS geofencing runs while the app is open; continuous background tracking is not guaranteed by browsers. Map tiles by OpenStreetMap.
        </p>
      </Card>
    </>
  );
}
