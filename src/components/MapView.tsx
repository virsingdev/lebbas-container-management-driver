'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export type MapStop = { id: string; routeId: string; lat: number; lng: number; code: string; place: string; seq: number; status: string; next: boolean };
const COLOR: Record<string, string> = { completed: '#16A34A', skipped: '#DC2626', failed: '#DC2626', en_route: '#2563EB', arrived: '#2563EB', pending: '#64748B' };

function Fit({ pts, me, tick }: { pts: [number, number][]; me: [number, number] | null; tick: number }) {
  const map = useMap();
  const key = pts.map((p) => p.join(',')).join(';');
  useEffect(() => { if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 }); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  useEffect(() => { if (me && tick > 0) map.setView(me, 16); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  return null;
}
export default function MapView({ stops, me, tick }: { stops: MapStop[]; me: { lat: number; lng: number; acc: number } | null; tick: number }) {
  const pts: [number, number][] = stops.map((s) => [s.lat, s.lng]);
  return (
    <MapContainer center={pts[0] ?? [25.12, 56.33]} zoom={11} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Fit pts={pts} me={me ? [me.lat, me.lng] : null} tick={tick} />
      {stops.map((s) => (
        <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={s.next ? 14 : 10} pathOptions={{ color: s.next ? '#0F766E' : '#fff', weight: s.next ? 4 : 2, fillColor: COLOR[s.status] ?? '#64748B', fillOpacity: 0.95 }}>
          <Popup><strong>{s.seq}. {s.code}</strong><br />{s.place}<br /><span className="capitalize">{s.status.replace('_', ' ')}</span><br /><Link href={`/stop?r=${s.routeId}&s=${s.id}`} className="font-semibold text-teal-700 underline">Open stop</Link></Popup>
        </CircleMarker>))}
      {me && <><Circle center={[me.lat, me.lng]} radius={Math.max(me.acc, 5)} pathOptions={{ color: '#2563EB', weight: 1, fillOpacity: 0.12 }} /><CircleMarker center={[me.lat, me.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563EB', fillOpacity: 1 }}><Popup>You are here (±{Math.round(me.acc)} m)</Popup></CircleMarker></>}
    </MapContainer>
  );
}
