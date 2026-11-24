'use client';
import { useEffect, useState } from 'react';

export type Fix = { latitude: number; longitude: number; accuracy: number; ts: number };
export function getFix(timeout = 8000): Promise<Fix | null> {
  return new Promise((res) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      (p) => res({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, ts: p.timestamp }),
      () => res(null), { enableHighAccuracy: true, timeout, maximumAge: 15000 });
  });
}
export type GeoPerm = 'granted' | 'denied' | 'prompt' | 'unsupported';
export function useGeoPermission(): GeoPerm {
  const [s, setS] = useState<GeoPerm>('prompt');
  useEffect(() => {
    if (!navigator.geolocation) { setS('unsupported'); return; }
    navigator.permissions?.query({ name: 'geolocation' as PermissionName }).then((p) => { setS(p.state as GeoPerm); p.onchange = () => setS(p.state as GeoPerm); }).catch(() => { /* iOS: state unknown until asked */ });
  }, []);
  return s;
}
