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

export function getFix(timeout = 8000): Promise<Fix | null> {
  return new Promise((res) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      (p) => res({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, ts: p.timestamp }),
      () => res(null),
      { enableHighAccuracy: true, timeout, maximumAge: 15000 }
    );
  });
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
