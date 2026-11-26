import type { Row } from './api';
import { distanceMeters, type Fix } from './geo';
import { DONE } from './hooks';

export const GEOFENCE_ENTER_M = 65;
export const GEOFENCE_EXIT_M = 95;
export const MAX_ACCURACY_M = 80;
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

export type ClosestStop = {
  stopId: string;
  routeId: string;
  containerCode: string;
  locationName: string;
  distanceM: number;
  status: string;
};

export function hasValidCoords(stop: Row): { lat: number; lng: number } | null {
  const rawLat = stop?.container?.latitude;
  const rawLng = stop?.container?.longitude;
  if (rawLat == null || rawLng == null || rawLat === '' || rawLng === '') return null;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

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
    const coords = hasValidCoords(s);
    if (!coords) continue;
    const d = distanceMeters(fix.latitude, fix.longitude, coords.lat, coords.lng);
    if (d <= radiusM && (!best || d < best.distanceM)) {
      best = { stop: s, distanceM: d, status };
    }
  }
  return best;
}

function buildExistingNearby(
  prev: NonNullable<DwellTracker>,
  route: Row,
  overlay: Map<string, { status: string }>,
  distanceM: number,
  dwellMs: number,
  dwelled: boolean
): NearbyStop | null {
  const existing = (route.stops as Row[]).find((s) => s.id === prev.stopId);
  if (!existing) return null;
  const status = overlay.get(existing.id)?.status ?? existing.status;
  if (DONE.includes(status)) return null;
  return {
    stopId: existing.id,
    routeId: route.id,
    containerCode: existing.container.container_code,
    locationName: existing.container.location_name,
    distanceM,
    dwellMs,
    dwelled,
    status,
  };
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
): { tracker: DwellTracker; nearby: NearbyStop | null; closest: ClosestStop | null; accuracyTooLow: boolean } {
  if (!route) {
    return { tracker: null, nearby: null, closest: null, accuracyTooLow: false };
  }

  const closestHit = findNearestStop(fix, route, overlay, Infinity);
  const closest: ClosestStop | null = closestHit
    ? {
        stopId: closestHit.stop.id,
        routeId: route.id,
        containerCode: closestHit.stop.container.container_code,
        locationName: closestHit.stop.container.location_name,
        distanceM: closestHit.distanceM,
        status: closestHit.status,
      }
    : null;

  if (fix.accuracy > MAX_ACCURACY_M) {
    // Preserve an active approach if a single noisy GPS reading arrives so the dwell timer doesn't reset.
    if (prev && prev.routeId === route.id) {
      const preserved = buildExistingNearby(prev, route, overlay, prev.distanceM, now - prev.enteredAt, prev.dwelled);
      if (preserved) {
        return { tracker: prev, nearby: preserved, closest, accuracyTooLow: true };
      }
    }
    return { tracker: prev, nearby: null, closest, accuracyTooLow: true };
  }

  // Keep tracking the currently dwelled/entered stop until the driver exits 95m or finishes it.
  if (prev && prev.routeId === route.id) {
    const existing = (route.stops as Row[]).find((s) => s.id === prev.stopId);
    const status = existing ? overlay.get(existing.id)?.status ?? existing.status : 'completed';
    if (existing && !DONE.includes(status)) {
      const coords = hasValidCoords(existing);
      if (coords) {
        const d = distanceMeters(fix.latitude, fix.longitude, coords.lat, coords.lng);
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
            closest,
            accuracyTooLow: false,
          };
        }
      }
    }
  }

  const nearest = findNearestStop(fix, route, overlay, GEOFENCE_ENTER_M);
  if (!nearest) return { tracker: null, nearby: null, closest, accuracyTooLow: false };

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
    closest,
    accuracyTooLow: false,
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
