import type { Row } from './api';
import { distanceMeters, type Fix } from './geo';
import { DONE } from './hooks';

export const GEOFENCE_ENTER_M = 65;
export const GEOFENCE_EXIT_M = 95;
export const MAX_ACCURACY_M = 50;
export const DWELL_MS = 45_000;

const PREF_KEY = 'lcd_geofence_enabled';

export type DwellTracker = {
  stopId: string;
  routeId: string;
  enteredAt: number;
  distanceM: number;
  dwelled: boolean;
} | null;

export type NearbyStop = {
  stopId: string;
  routeId: string;
  containerCode: string;
  locationName: string;
  distanceM: number;
  dwellMs: number;
  dwelled: boolean;
  status: string;
};

/** Finds the closest open stop with valid coordinates within `radiusM`. */
export function findNearestStop(
  fix: Fix,
  route: Row | undefined,
  overlay: Map<string, { status: string }>,
  radiusM: number
): { stop: Row; distanceM: number; status: string } | null {
  if (!route?.stops?.length) return null;
  let best: { stop: Row; distanceM: number; status: string } | null = null;
  for (const s of route.stops as Row[]) {
    const status = overlay.get(s.id)?.status ?? s.status;
    if (DONE.includes(status)) continue;
    const lat = Number(s.container?.latitude);
    const lng = Number(s.container?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
    const d = distanceMeters(fix.latitude, fix.longitude, lat, lng);
    if (d <= radiusM && (!best || d < best.distanceM)) {
      best = { stop: s, distanceM: d, status };
    }
  }
  return best;
}

/**
 * Pure state transition for foreground GPS geofencing + dwell detection.
 * Uses entry/exit hysteresis (65m enter, 95m exit) to prevent GPS boundary jitter
 * from resetting the dwell timer.
 */
export function stepDwellTracker(
  prev: DwellTracker,
  fix: Fix,
  route: Row | undefined,
  overlay: Map<string, { status: string }>,
  now: number
): { tracker: DwellTracker; nearby: NearbyStop | null } {
  if (!route || fix.accuracy > MAX_ACCURACY_M) {
    return { tracker: prev, nearby: null };
  }

  // Keep tracking the currently dwelled/entered stop until the driver exits 95m or finishes it.
  if (prev && prev.routeId === route.id) {
    const existing = (route.stops as Row[]).find((s) => s.id === prev.stopId);
    const status = existing ? overlay.get(existing.id)?.status ?? existing.status : 'completed';
    if (existing && !DONE.includes(status)) {
      const lat = Number(existing.container?.latitude);
      const lng = Number(existing.container?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const d = distanceMeters(fix.latitude, fix.longitude, lat, lng);
        if (d <= GEOFENCE_EXIT_M) {
          const dwellMs = now - prev.enteredAt;
          const dwelled = prev.dwelled || dwellMs >= DWELL_MS;
          const next: DwellTracker = { ...prev, distanceM: d, dwelled };
          return {
            tracker: next,
            nearby: {
              stopId: existing.id,
              routeId: route.id,
              containerCode: existing.container.container_code,
              locationName: existing.container.location_name,
              distanceM: d,
              dwellMs,
              dwelled,
              status,
            },
          };
        }
      }
    }
  }

  const nearest = findNearestStop(fix, route, overlay, GEOFENCE_ENTER_M);
  if (!nearest) return { tracker: null, nearby: null };

  const tracker: DwellTracker = {
    stopId: nearest.stop.id,
    routeId: route.id,
    enteredAt: now,
    distanceM: nearest.distanceM,
    dwelled: false,
  };
  return {
    tracker,
    nearby: {
      stopId: nearest.stop.id,
      routeId: route.id,
      containerCode: nearest.stop.container.container_code,
      locationName: nearest.stop.container.location_name,
      distanceM: nearest.distanceM,
      dwellMs: 0,
      dwelled: false,
      status: nearest.status,
    },
  };
}

export function getGeofenceEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const v = window.localStorage.getItem(PREF_KEY);
  return v === null ? true : v === '1';
}

export function setGeofenceEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PREF_KEY, enabled ? '1' : '0');
}
