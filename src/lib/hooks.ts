'use client';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { api, type Row } from './api';
import { cached } from './cached';
import { db, type Op } from './db';
import { useDriver } from '@/components/Providers';

export function useRoutes() {
  return useQuery({ queryKey: ['routes'], refetchInterval: 60_000, queryFn: () => cached<Row[]>('routes', () => api('/driver/routes?page_size=50').then((d) => d.items as Row[])) });
}
// Locally queued, not-yet-confirmed stop updates. They show as "pending sync" on top of server data.
export function useOverlay() {
  const { driver } = useDriver();
  const ops = useLiveQuery(() => db.ops.where('driverId').equals(driver.id).and((o) => o.status !== 'synced' && o.type === 'route_stop_status_update').sortBy('createdAt'), [driver.id], [] as Op[]);
  const m = new Map<string, { status: string; op: Op }>();
  ops.forEach((o) => { if (o.stopId) m.set(o.stopId, { status: String(o.payload.status), op: o }); });
  return m;
}
export const DONE = ['completed', 'skipped', 'failed'];
export function summarize(route: Row | undefined, ov: Map<string, { status: string }>) {
  const stops: Row[] = (route?.stops ?? []).slice().sort((a: Row, b: Row) => a.sequence_number - b.sequence_number);
  const eff = (s: Row) => ov.get(s.id)?.status ?? s.status;
  const done = stops.filter((s) => eff(s) === 'completed').length;
  const closed = stops.filter((s) => DONE.includes(eff(s))).length;
  return { stops, eff, total: stops.length, done, closed, pending: stops.length - closed, next: stops.find((s) => !DONE.includes(eff(s))) };
}
export function pickRoute(routes: Row[] | undefined) {
  const today = new Date().toLocaleDateString('en-CA');
  return routes?.find((r) => r.route_date === today && r.status !== 'completed' && r.status !== 'cancelled') ?? routes?.find((r) => r.status === 'in_progress') ?? routes?.find((r) => r.route_date === today);
}
