'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, MapPin, Navigation, Radar, X } from 'lucide-react';
import { uid, type Row } from '@/lib/api';
import { formatDistance, getFixWithStatus, type Fix } from '@/lib/geo';
import { roundCoord, roundTo } from '@/lib/coords';
import {
  DWELL_MS,
  getGeofenceEnabled,
  hasValidCoords,
  setGeofenceEnabled,
  stepDwellTracker,
  type ClosestStop,
  type DwellTracker,
  type NearbyStop,
} from '@/lib/geofence';
import { pickRoute, useOverlay, useRoutes } from '@/lib/hooks';
import { enqueue } from '@/lib/sync';
import { Btn, Sheet, cn, inputCls } from './ui';

export type DetectorState =
  | 'off'
  | 'no_route'
  | 'no_coords'
  | 'waiting_gps'
  | 'low_accuracy'
  | 'scanning'
  | 'approaching'
  | 'dwelled'
  | 'error';

type GeofenceCtxValue = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  fix: Fix | null;
  nearby: NearbyStop | null;
  closest: ClosestStop | null;
  detectorState: DetectorState;
  geoError: string;
  refreshGps: () => Promise<Fix | null>;
};

const GeofenceCtx = createContext<GeofenceCtxValue>({
  enabled: true,
  setEnabled: () => {},
  fix: null,
  nearby: null,
  closest: null,
  detectorState: 'waiting_gps',
  geoError: '',
  refreshGps: async () => null,
});

export const useGeofence = () => useContext(GeofenceCtx);

const prefListeners = new Set<() => void>();
const subscribePref = (cb: () => void) => {
  prefListeners.add(cb);
  return () => { prefListeners.delete(cb); };
};

const QUICK_WEIGHTS = [10, 20, 30, 50];
const QUICK_BAGS = [1, 2, 3, 5];

export function GeofenceProvider({ children }: { children: ReactNode }) {
  const routes = useRoutes();
  const ov = useOverlay();
  const pathname = usePathname();
  const enabled = useSyncExternalStore(subscribePref, getGeofenceEnabled, () => true);
  const [fix, setFix] = useState<Fix | null>(null);
  const [nearby, setNearby] = useState<NearbyStop | null>(null);
  const [closest, setClosest] = useState<ClosestStop | null>(null);
  const [accuracyLow, setAccuracyLow] = useState(false);
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

  const evaluate = useCallback((currentFix: Fix) => {
    const res = stepDwellTracker(trackerRef.current, currentFix, routeRef.current, ovRef.current, Date.now());
    trackerRef.current = res.tracker;
    setNearby(res.nearby);
    setClosest(res.closest);
    setAccuracyLow(res.accuracyTooLow);
    if (!res.nearby) {
      setDismissedStopId((prev) => (prev ? null : prev));
    }

    const n = res.nearby;
    if (
      n &&
      n.dwelled &&
      (routeRef.current?.status === 'in_progress' || routeRef.current?.status === 'assigned') &&
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
        toast.success(`Arrived near ${n.containerCode} (${formatDistance(n.distanceM)})`);
      });
    }
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setGeofenceEnabled(v);
    prefListeners.forEach((cb) => cb());
    if (!v) {
      trackerRef.current = null;
      setNearby(null);
      setClosest(null);
      setAccuracyLow(false);
      setSheetOpen(false);
    }
  }, []);

  const refreshGps = useCallback(async (): Promise<Fix | null> => {
    const res = await getFixWithStatus(8000);
    if (res.denied) {
      setGeoError('Location permission denied. Enable GPS in your browser settings.');
      return null;
    }
    if (!res.fix) {
      setGeoError('Could not get GPS signal. Move near a window or outdoors.');
      return null;
    }
    fixRef.current = res.fix;
    setFix(res.fix);
    setGeoError('');
    evaluate(res.fix);
    return res.fix;
  }, [evaluate]);

  const hasStopsWithGps = Boolean(
    route &&
      route.status !== 'completed' &&
      route.status !== 'cancelled' &&
      (route.stops as Row[] | undefined)?.some((s) => hasValidCoords(s) !== null)
  );

  // Keep GPS active while route has stops with GPS, or while viewing Map/Profile/Home so driver always sees live status.
  const shouldWatchGps =
    enabled &&
    (hasStopsWithGps ||
      pathname === '/' ||
      pathname.startsWith('/map') ||
      pathname.startsWith('/profile'));

  useEffect(() => {
    if (!shouldWatchGps || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    let active = true;
    let highAccuracy = true;
    let watchId: number | null = null;
    let wakeLock: { release: () => Promise<void> } | null = null;

    const requestWakeLock = () => {
      if (document.visibilityState !== 'visible') return;
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      wl?.request('screen').then((sentinel) => {
        if (!active) { void sentinel.release().catch(() => null); return; }
        wakeLock = sentinel;
      }).catch(() => null);
    };

    const startWatch = (hi: boolean) => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      highAccuracy = hi;
      watchId = navigator.geolocation.watchPosition(
        (p) => {
          if (!active) return;
          const nextFix: Fix = {
            latitude: roundCoord(p.coords.latitude),
            longitude: roundCoord(p.coords.longitude),
            accuracy: roundTo(p.coords.accuracy, 1),
            ts: p.timestamp,
          };
          fixRef.current = nextFix;
          setFix(nextFix);
          setGeoError('');
          evaluate(nextFix);
        },
        (e) => {
          if (!active) return;
          if (e.code === 1) {
            setGeoError('Location permission denied. Enable GPS in browser settings.');
            return;
          }
          // If high-accuracy watch fails/times out (common indoors or on laptops), fall back to coarse watch.
          if (highAccuracy) {
            startWatch(false);
          } else if (!fixRef.current) {
            setGeoError('Waiting for GPS signal…');
          }
        },
        { enableHighAccuracy: hi, maximumAge: hi ? 10000 : 30000, timeout: hi ? 15000 : 20000 }
      );
    };

    const warmUp = () => {
      void getFixWithStatus(8000).then((res) => {
        if (!active) return;
        if (res.denied) {
          setGeoError('Location permission denied. Enable GPS in your browser settings.');
          return;
        }
        if (!res.fix) return;
        fixRef.current = res.fix;
        setFix(res.fix);
        setGeoError('');
        evaluate(res.fix);
      });
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      requestWakeLock();
      warmUp();
    };

    requestWakeLock();
    document.addEventListener('visibilitychange', onVisibility);
    // Warm up immediately with getFixWithStatus so first fix arrives quickly even before watchPosition settles.
    warmUp();
    startWatch(true);

    // Tick dwell progress smoothly every 2s while parked near a container and refresh stale fixes.
    const timer = setInterval(() => {
      const f = fixRef.current;
      if (!f) return;
      const age = Date.now() - f.ts;
      if (trackerRef.current && age <= 300_000) {
        evaluate(f);
      } else if (age <= 90_000) {
        evaluate(f);
      }
      if (trackerRef.current && age > 25_000) {
        void getFixWithStatus(4000).then((res) => {
          if (!active || !res.fix) return;
          fixRef.current = res.fix;
          setFix(res.fix);
          evaluate(res.fix);
        });
      }
    }, 2000);

    return () => {
      active = false;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      void wakeLock?.release().catch(() => null);
    };
  }, [shouldWatchGps, evaluate]);

  // Re-evaluate immediately when route or overlay changes (e.g., stop completed elsewhere).
  useEffect(() => {
    const f = fixRef.current;
    if (!f || !enabled) return;
    let active = true;
    Promise.resolve().then(() => {
      if (active) evaluate(f);
    });
    return () => {
      active = false;
    };
  }, [route, ov, enabled, evaluate]);

  const detectorState: DetectorState = !enabled
    ? 'off'
    : geoError && !fix
      ? 'error'
      : !fix
        ? 'waiting_gps'
        : !route
          ? 'no_route'
          : !hasStopsWithGps
            ? 'no_coords'
            : nearby?.dwelled
              ? 'dwelled'
              : nearby
                ? 'approaching'
                : accuracyLow
                  ? 'low_accuracy'
                  : 'scanning';

  const onStopPage = pathname.startsWith('/stop');
  const showDwelledPrompt = Boolean(nearby?.dwelled) && nearby?.stopId !== dismissedStopId && !onStopPage;
  const showApproachingBar = Boolean(nearby && !nearby.dwelled) && !onStopPage;

  const dwellPct = nearby ? Math.min(100, Math.round((nearby.dwellMs / DWELL_MS) * 100)) : 0;
  const secsLeft = nearby ? Math.max(0, Math.ceil((DWELL_MS - nearby.dwellMs) / 1000)) : 0;

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
    <GeofenceCtx.Provider
      value={{
        enabled,
        setEnabled,
        fix,
        nearby,
        closest,
        detectorState,
        geoError,
        refreshGps,
      }}
    >
      {children}

      {showApproachingBar && nearby && (
        <div
          role="region"
          aria-label="Detecting nearby container"
          className="fixed bottom-[76px] left-1/2 z-30 w-full max-w-[460px] -translate-x-1/2 px-3"
        >
          <div className="overflow-hidden rounded-2xl border border-teal-200 bg-white/95 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0FDFA] text-[#0F766E]">
                  <Radar size={18} className="animate-pulse" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-[#0F766E]">
                    <span>Near {nearby.containerCode} · {formatDistance(nearby.distanceM)}</span>
                    <span className="font-medium text-slate-500">· {secsLeft}s</span>
                  </p>
                  <p className="truncate text-sm font-semibold text-slate-900">{nearby.locationName}</p>
                </div>
              </div>
              <Link
                href={`/stop?r=${nearby.routeId}&s=${nearby.stopId}`}
                className="shrink-0 rounded-xl border border-teal-200 bg-[#F0FDFA] px-3 py-2 text-xs font-bold text-[#0F766E] active:bg-teal-100"
              >
                Open
              </Link>
            </div>
            <div className="h-1.5 w-full bg-teal-100">
              <div
                className="h-full bg-[#0F766E] transition-all duration-500"
                style={{ width: `${dwellPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {showDwelledPrompt && nearby && (
        <div
          role="region"
          aria-label="Nearby container detected"
          className="fixed bottom-[76px] left-1/2 z-30 w-full max-w-[460px] -translate-x-1/2 px-3"
        >
          <div className="flex items-center justify-between gap-2.5 rounded-2xl border-2 border-[#0F766E] bg-gradient-to-r from-[#F0FDFA] to-emerald-50 p-3 shadow-xl">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0F766E] text-white">
                <MapPin size={20} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#0F766E]">
                  <CheckCircle2 size={13} aria-hidden /> Arrived · {nearby.containerCode} ({formatDistance(nearby.distanceM)})
                </p>
                <p className="truncate text-sm font-bold text-slate-900">{nearby.locationName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="shrink-0 rounded-xl bg-[#0F766E] px-3.5 py-2.5 text-sm font-bold text-white shadow-sm active:scale-[0.98] active:bg-[#134E4A]"
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
          <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-teal-200 bg-[#F0FDFA] p-3 text-sm text-[#134E4A]">
            <Navigation size={18} className="shrink-0 text-[#0F766E]" aria-hidden />
            <span>
              GPS verified (<strong>{formatDistance(nearby.distanceM)}</strong> away, {Math.max(Math.round(nearby.dwellMs / 1000), Math.round(DWELL_MS / 1000))}s dwell). No QR scan needed.
            </span>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Weight (kg) *
                <input
                  className={cn(inputCls, 'mt-1.5')}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Enter weight in kg"
                  value={w}
                  onChange={(e) => setW(e.target.value)}
                  aria-invalid={w !== '' && !wOk}
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_WEIGHTS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setW(String(val))}
                    className={cn(
                      'rounded-xl border px-3 py-1.5 text-xs font-bold transition',
                      Number(w) === val
                        ? 'border-[#0F766E] bg-[#0F766E] text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    {val} kg
                  </button>
                ))}
              </div>
              {w !== '' && !wOk && <p className="mt-1 text-sm text-red-700">Weight must be more than 0.</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Number of bags
                <input
                  className={cn(inputCls, 'mt-1.5')}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="Optional"
                  value={bags}
                  onChange={(e) => setBags(e.target.value)}
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_BAGS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setBags(String(val))}
                    className={cn(
                      'rounded-xl border px-3 py-1.5 text-xs font-bold transition',
                      Number(bags) === val
                        ? 'border-[#0F766E] bg-[#0F766E] text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    {val} {val === 1 ? 'bag' : 'bags'}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-sm font-semibold text-slate-700">
              Notes
              <textarea
                className={cn(inputCls, 'mt-1.5 py-2.5')}
                rows={2}
                placeholder="Optional condition or remarks"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

            <Btn disabled={!wOk || busy} onClick={confirmPickup}>
              {busy ? 'Saving…' : 'Confirm pickup'}
            </Btn>
            <Link
              href={`/stop?r=${nearby.routeId}&s=${nearby.stopId}&geofence=1`}
              onClick={() => setSheetOpen(false)}
              className="flex min-h-[48px] w-full items-center justify-center rounded-2xl border-2 border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open full stop / Scan QR
            </Link>
          </div>
        </Sheet>
      )}
    </GeofenceCtx.Provider>
  );
}
