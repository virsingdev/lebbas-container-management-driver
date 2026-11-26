'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GEOFENCE_ENTER_M } from '@/lib/geofence';

export type MapStop = {
  id: string;
  routeId: string;
  lat: number;
  lng: number;
  code: string;
  place: string;
  seq: number;
  status: string;
  next: boolean;
};

const COLOR: Record<string, string> = {
  completed: '#16A34A',
  skipped: '#DC2626',
  failed: '#DC2626',
  en_route: '#2563EB',
  arrived: '#0F766E',
  pending: '#64748B',
};

const DONE_SET = new Set(['completed', 'skipped', 'failed']);

export default function MapView({
  stops,
  me,
  tick,
}: {
  stops: MapStop[];
  me: { lat: number; lng: number; acc: number } | null;
  tick: number;
}) {
  const router = useRouter();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fittedKeyRef = useRef<string>('');
  const centeredOnceRef = useRef<boolean>(false);

  // Initialize Leaflet safely once per mount (React 18 StrictMode & Fast Refresh safe).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Prevent double initialization caused by StrictMode double‑render.
    if (host.getAttribute('data-leaflet-initialized') === 'true') return;

    // Ensure a clean container.
    host.innerHTML = '';
    const container = document.createElement('div');
    container.style.height = '100%';
    container.style.width = '100%';
    host.appendChild(container);

    const map = L.map(container, {
      center: [25.2048, 55.2708],
      zoom: 12,
      scrollWheelZoom: true,
    });
    // Mark as initialized for the lifetime of this element.
    host.setAttribute('data-leaflet-initialized', 'true');

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;
    fittedKeyRef.current = '';
    centeredOnceRef.current = false;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      // Clean up for possible future mounts.
      host.innerHTML = '';
      host.removeAttribute('data-leaflet-initialized');
    };
  }, []);


  // Sync stop markers, 65m geofence zones, and live driver position.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    for (const s of stops) {
      if (!DONE_SET.has(s.status)) {
        L.circle([s.lat, s.lng], {
          radius: GEOFENCE_ENTER_M,
          color: '#0F766E',
          weight: 1,
          dashArray: '4 4',
          fillColor: '#14B8A6',
          fillOpacity: s.next ? 0.14 : 0.07,
        }).addTo(layer);
      }

      const marker = L.circleMarker([s.lat, s.lng], {
        radius: s.next ? 13 : 9,
        color: s.next ? '#0F766E' : '#ffffff',
        weight: s.next ? 4 : 2,
        fillColor: COLOR[s.status] ?? '#64748B',
        fillOpacity: 0.95,
      }).addTo(layer);

      const popup = document.createElement('div');
      popup.className = 'text-xs leading-relaxed';

      const title = document.createElement('strong');
      title.textContent = `${s.seq}. ${s.code}`;
      popup.appendChild(title);
      popup.appendChild(document.createElement('br'));

      const place = document.createElement('span');
      place.textContent = s.place;
      popup.appendChild(place);
      popup.appendChild(document.createElement('br'));

      const status = document.createElement('span');
      status.className = 'capitalize text-slate-600';
      status.textContent = s.status.replace(/_/g, ' ');
      popup.appendChild(status);
      popup.appendChild(document.createElement('br'));

      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'mt-1 font-semibold text-teal-700 underline';
      link.textContent = 'Open stop';
      link.onclick = () => router.push(`/stop?r=${s.routeId}&s=${s.id}`);
      popup.appendChild(link);

      marker.bindPopup(popup);
    }

    if (me) {
      L.circle([me.lat, me.lng], {
        radius: Math.max(me.acc, 5),
        color: '#2563EB',
        weight: 1,
        fillOpacity: 0.12,
      }).addTo(layer);

      L.circleMarker([me.lat, me.lng], {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#2563EB',
        fillOpacity: 1,
      })
        .bindPopup(`You are here (±${Math.round(me.acc)} m)`)
        .addTo(layer);
    }

    const pts: [number, number][] = stops.map((s) => [s.lat, s.lng]);
    const key = pts.map((p) => p.join(',')).join(';');
    if (pts.length && key !== fittedKeyRef.current) {
      fittedKeyRef.current = key;
      map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
    } else if (!pts.length && me && !centeredOnceRef.current) {
      centeredOnceRef.current = true;
      map.setView([me.lat, me.lng], 15);
    }
  }, [stops, me, router]);

  // Recenter when driver taps "Centre on my location" or "Refresh GPS".
  useEffect(() => {
    const map = mapRef.current;
    if (map && me && tick > 0) {
      map.setView([me.lat, me.lng], 16);
    }
  }, [tick, me]);

  return <div ref={hostRef} className="h-full w-full" />;
}
