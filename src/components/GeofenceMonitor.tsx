'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { MapPin, X } from 'lucide-react';
import { uid, type Row } from '@/lib/api';
import { getFix, type Fix } from '@/lib/geo';
import {
  DWELL_MS,
  getGeofenceEnabled,
  setGeofenceEnabled,
  stepDwellTracker,
  type DwellTracker,
  type NearbyStop,
} from '@/lib/geofence';
import { pickRoute, useOverlay, useRoutes } from '@/lib/hooks';
import { enqueue } from '@/lib/sync';
import { Btn, Sheet, inputCls } from './ui';

type GeofenceCtxValue = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  fix: Fix | null;
  nearby: NearbyStop | null;
  geoError: string;
};

const GeofenceCtx = createContext<GeofenceCtxValue>({
  enabled: true,
  setEnabled: () => {},
  fix: null,
  nearby: null,
  geoError: '',
});

export const useGeofence = () => useContext(GeofenceCtx);

const prefListeners = new Set<() => void>();
const subscribePref = (cb: () => void) => {
  prefListeners.add(cb);
  return () => { prefListeners.delete(cb); };
};

export function GeofenceProvider({ children }: { children: ReactNode }) {
  const routes = useRoutes();
  const ov = useOverlay();
  const pathname = usePathname();
  const enabled = useSyncExternalStore(subscribePref, getGeofenceEnabled, () => true);
  const [fix, setFix] = useState<Fix | null>(null);
  const [nearby, setNearby] = useState<NearbyStop | null>(null);
  const [geoError, setGeoError] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dismissedStopId, setDismissedStopId] = useState<string | null>(null);
  const [w, setW] = useState('');
  const [bags, setBags] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const route: Row | undefined = pickRoute(routes.data?.data);
  const routeRef = useRef<Row | undefined>(route);
  const ovRef = useRef(ov);
  const fixRef = useRef<Fix | null>(null);
  const trackerRef = useRef<DwellTracker>(null);
  const autoArrivedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    routeRef.current = route;
    ovRef.current = ov;
  }, [route, ov]);

  const setEnabled = useCallback((v: boolean) => {
    setGeofenceEnabled(v);
    prefListeners.forEach((cb) => cb());
    if (!v) {
      trackerRef.current = null;
      setNearby(null);
      setSheetOpen(false);
    }
  }, []);

  const evaluate = useCallback((currentFix: Fix) => {
    const res = stepDwellTracker(trackerRef.current, currentFix, routeRef.current, ovRef.current, Date.now());
    trackerRef.current = res.tracker;
    setNearby(res.nearby);

    const n = res.nearby;
    if (
      n &&
      n.dwelled &&
      routeRef.current?.status === 'in_progress' &&
      (n.status === 'pending' || n.status === 'en_route') &&
      !autoArrivedRef.current.has(n.stopId)
    ) {
      autoArrivedRef.current.add(n.stopId);
      const id = uid();
      void enqueue({
        id,
        type: 'route_stop_status_update',
        routeId: n.routeId,
        stopId: n.stopId,
        label: `Auto-arrived ${n.containerCode}`,
        payload: {
          status: 'arrived',
          latitude: currentFix.latitude,
          longitude: currentFix.longitude,
          gps_accuracy_meters: currentFix.accuracy,
          sync_idempotency_key: id,
        },
      }).then(() => {
        toast.success(`Arrived near ${n.containerCode} (~${Math.round(n.distanceM)} m)`);
      });
    }
  }, []);

  const hasStopsWithGps = Boolean(
    route &&
      route.status !== 'completed' &&
      route.status !== 'cancelled' &&
      (route.stops as Row[] | undefined)?.some((s) => {
        const rawLat = s.container?.latitude;
        const rawLng = s.container?.longitude;
        if (rawLat == null || rawLng == null || rawLat === '' || rawLng === '') return false;
        const lat = Number(rawLat);
        const lng = Number(rawLng);
        return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
      })
  );

  useEffect(() => {
    if (!enabled || !hasStopsWithGps || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    let active = true;
    let wakeLock: { release: () => Promise<void> } | null = null;

    const requestWakeLock = () => {
      if (document.visibilityState !== 'visible') return;
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      wl?.request('screen').then((sentinel) => {
        if (!active) { void sentinel.release().catch(() => null); return; }
        wakeLock = sentinel;
      }).catch(() => null);
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      requestWakeLock();
      void getFix(6000).then((f) => {
        if (!active || !f) return;
        fixRef.current = f;
        setFix(f);
        setGeoError('');
        evaluate(f);
      });
    };

    requestWakeLock();
    document.addEventListener('visibilitychange', onVisibility);

    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        if (!active) return;
        const nextFix: Fix = {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          ts: p.timestamp,
        };
        fixRef.current = nextFix;
        setFix(nextFix);
        setGeoError('');
        evaluate(nextFix);
      },
      (e) => {
        if (!active) return;
        setGeoError(
          e.code === 1
            ? 'Location permission denied. Enable GPS in browser settings.'
            : 'Waiting for GPS signal…'
        );
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );

    // Re-evaluate dwell time even when the vehicle is parked and GPS coordinates stay stationary.
    const timer = setInterval(() => {
      const f = fixRef.current;
      if (f && Date.now() - f.ts <= 90_000) evaluate(f);
    }, 5000);

    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      void wakeLock?.release().catch(() => null);
    };
  }, [enabled, hasStopsWithGps, evaluate]);

  const showPrompt =
    Boolean(nearby?.dwelled) &&
    nearby?.stopId !== dismissedStopId &&
    !pathname.startsWith('/stop');

  const wn = Number(w);
  const wOk = w !== '' && wn > 0;

  async function confirmPickup() {
    if (!nearby || !wOk || busy) return;
    setBusy(true);
    try {
      const id = uid();
      const f = fixRef.current;
      await enqueue({
        id,
        type: 'route_stop_status_update',
        routeId: nearby.routeId,
        stopId: nearby.stopId,
        label: `Collected ${nearby.containerCode}`,
        payload: {
          status: 'completed',
          collected_weight_kg: wn,
          bag_count: Number(bags || 0),
          collected_at: new Date().toISOString(),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(f ? { latitude: f.latitude, longitude: f.longitude, gps_accuracy_meters: f.accuracy } : {}),
          sync_idempotency_key: id,
        },
      });
      toast.success(`Pickup saved for ${nearby.containerCode}. Syncing…`);
      setSheetOpen(false);
      setW('');
      setBags('');
      setNotes('');
      setNearby(null);
      trackerRef.current = null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <GeofenceCtx.Provider value={{ enabled, setEnabled, fix, nearby, geoError }}>
      {children}
      {showPrompt && nearby && (
        <div
          role="region"
          aria-label="Nearby container detected"
          className="fixed inset-x-0 bottom-[72px] z-30 mx-auto max-w-xl px-4"
        >
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[#0F766E] bg-[#F0FDFA] p-3 shadow-lg">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#0F766E]">
                <MapPin size={14} aria-hidden /> Near {nearby.containerCode} · {Math.round(nearby.distanceM)} m
              </p>
              <p className="truncate text-sm font-semibold text-slate-900">{nearby.locationName}</p>
            </div>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="shrink-0 rounded-xl bg-[#0F766E] px-3.5 py-2.5 text-sm font-semibold text-white active:bg-[#134E4A]"
            >
              Confirm pickup
            </button>
            <button
              type="button"
              aria-label="Dismiss pickup prompt"
              onClick={() => setDismissedStopId(nearby.stopId)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/60"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>
      )}
      {sheetOpen && nearby && (
        <Sheet title={`Confirm pickup · ${nearby.containerCode}`} onClose={() => setSheetOpen(false)}>
          <p className="mb-3 rounded-xl bg-[#F0FDFA] p-3 text-sm text-[#134E4A]">
            GPS geofence verified (~{Math.round(nearby.distanceM)} m away, {Math.max(Math.round(nearby.dwellMs / 1000), Math.round(DWELL_MS / 1000))}s dwell). No QR scan needed.
          </p>
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Weight (kg) *
              <input
                className={inputCls}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={w}
                onChange={(e) => setW(e.target.value)}
                aria-invalid={w !== '' && !wOk}
              />
            </label>
            {w !== '' && !wOk && <p className="text-sm text-red-700">Weight must be more than 0.</p>}
            <label className="block text-sm font-medium">
              Number of bags
              <input
                className={inputCls}
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={bags}
                onChange={(e) => setBags(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              Notes
              <textarea className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <Btn disabled={!wOk || busy} onClick={confirmPickup}>
              {busy ? 'Saving…' : 'Confirm pickup'}
            </Btn>
            <Link
              href={`/stop?r=${nearby.routeId}&s=${nearby.stopId}&geofence=1`}
              onClick={() => setSheetOpen(false)}
              className="flex min-h-[48px] w-full items-center justify-center rounded-2xl border-2 border-slate-200 font-semibold text-slate-700"
            >
              Open full stop / Scan QR
            </Link>
          </div>
        </Sheet>
      )}
    </GeofenceCtx.Provider>
  );
}
