'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { Toaster, toast } from 'sonner';
import { api, ApiError, type Row } from '@/lib/api';
import { cached } from '@/lib/cached';
import { db, type Op } from '@/lib/db';
import { setSyncHooks, syncNow } from '@/lib/sync';
import { Btn } from './ui';

export type Net = 'online' | 'offline' | 'unreachable';
type Status = { net: Net; syncing: boolean; pending: number; attention: number };
const Ctx = createContext<{ driver: Row; status: Status; ping: () => void; ops: Op[] } | null>(null);
export function useDriver() { const c = useContext(Ctx); if (!c) throw new Error('useDriver outside provider'); return c; }

function Gate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['driver'], queryFn: () => cached<Row>('driver', () => api('/driver/me')), retry: false, networkMode: 'always' });
  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    await db.cache.clear(); // route data is wiped; unsynced operations stay on the device for this driver
    qc.clear();
    router.replace('/login');
  }, [qc, router]);
  const [net, setNet] = useState<Net>('online');
  const driverId = me.data?.data.id as string | undefined;
  const ops = useLiveQuery(() => (driverId ? db.ops.where('driverId').equals(driverId).toArray() : []), [driverId], [] as Op[]);
  const pingRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!driverId) return;
    setSyncHooks({ driverId, onSynced: () => qc.invalidateQueries({ queryKey: ['routes'] }) });
    db.ops.where('status').equals('syncing').modify({ status: 'pending' }).then(() => syncNow()); // recover from an interrupted sync
    const ping = async () => {
      if (!navigator.onLine) return setNet('offline');
      try { await api('/health'); setNet('online'); void syncNow(); } catch { setNet('unreachable'); }
    };
    pingRef.current = ping; void ping();
    const t = setInterval(() => { void ping(); }, 30000);
    const off = () => setNet('offline');
    window.addEventListener('online', ping); window.addEventListener('offline', off);
    if (navigator.onLine) ['/', '/route', '/stop', '/map', '/history', '/profile', '/incidents', '/scan'].forEach((p) => fetch(p).catch(() => null)); // lets the service worker keep pages for offline use
    return () => { clearInterval(t); window.removeEventListener('online', ping); window.removeEventListener('offline', off); };
  }, [driverId, qc]);
  const ping = useCallback(() => pingRef.current(), []);
  if (me.isLoading) return <div className="p-8 text-center text-slate-500">Loading…</div>;
  if (me.error instanceof ApiError && (me.error.status === 403 || me.error.status === 404)) return (
    <div className="space-y-4 p-6 text-center"><h1 className="text-xl font-bold">This is not a driver account</h1><p className="text-slate-600">Your login has no driver profile. Ask your supervisor to link it.</p><Btn onClick={signOut}>Sign out</Btn></div>);
  if (me.error || !me.data) return <div className="space-y-4 p-6 text-center"><p className="text-red-700">Could not load your profile{!navigator.onLine && ' (you are offline and nothing is saved yet)'}.</p><Btn onClick={() => me.refetch()}>Try again</Btn></div>;
  const status: Status = { net, syncing: ops.some((o) => o.status === 'syncing'), pending: ops.filter((o) => o.status === 'pending' || o.status === 'syncing').length, attention: ops.filter((o) => o.status === 'failed' || o.status === 'conflict').length };
  return <Ctx.Provider value={{ driver: me.data.data, status, ping, ops }}>{children}</Ctx.Provider>;
}

export function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) toast('A new version is ready', { duration: Infinity, action: { label: 'Update', onClick: () => { w.postMessage('SKIP_WAITING'); location.reload(); } } });
        });
      });
    }).catch(() => null);
  }, []);
  return null;
}

export function Providers({ children, auth = true }: { children: ReactNode; auth?: boolean }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 15_000, retry: 1, networkMode: 'always' } } }));
  return <QueryClientProvider client={qc}><SwRegister />{auth ? <Gate>{children}</Gate> : children}<Toaster richColors position="top-center" /></QueryClientProvider>;
}
