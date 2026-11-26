'use client';
import { useEffect, useState } from 'react';

export type Fix = { latitude: number; longitude: number; accuracy: number; ts: number };

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters between two WGS84 coordinates. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function readPosition(options: PositionOptions): Promise<{ fix: Fix | null; denied: boolean }> {
  return new Promise((res) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return res({ fix: null, denied: false });
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        res({
          fix: {
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            accuracy: p.coords.accuracy,
            ts: p.timestamp,
          },
          denied: false,
        }),
      (err) => res({ fix: null, denied: err.code === 1 }),
      options
    );
  });
}

export async function getFixWithStatus(timeout = 8000): Promise<{ fix: Fix | null; denied: boolean }> {
  const hi = await readPosition({ enableHighAccuracy: true, timeout, maximumAge: 15000 });
  if (hi.fix || hi.denied) return hi;
  // Fallback to network/coarse location if high-accuracy GPS times out indoors or on desktop.
  return readPosition({
    enableHighAccuracy: false,
    timeout: Math.min(timeout, 6000),
    maximumAge: 60000,
  });
}

export async function getFix(timeout = 8000): Promise<Fix | null> {
  const res = await getFixWithStatus(timeout);
  return res.fix;
}

export type GeoPerm = 'granted' | 'denied' | 'prompt' | 'unsupported';

export function useGeoPermission(): GeoPerm {
  const [s, setS] = useState<GeoPerm>('prompt');
  useEffect(() => {
    let active = true;
    if (!navigator.geolocation) {
      Promise.resolve().then(() => { if (active) setS('unsupported'); });
      return () => { active = false; };
    }
    navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((p) => {
        if (!active) return;
        setS(p.state as GeoPerm);
        p.onchange = () => { if (active) setS(p.state as GeoPerm); };
      })
      .catch(() => { /* iOS Safari: permission state remains unknown until prompted */ });
    return () => { active = false; };
  }, []);
  return s;
}
