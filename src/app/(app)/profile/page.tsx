'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LocateFixed, LogOut, Radar, Smartphone, User } from 'lucide-react';
import { api, type Row } from '@/lib/api';
import { cached } from '@/lib/cached';
import { db } from '@/lib/db';
import { formatDistance, useGeoPermission } from '@/lib/geo';
import { pickRoute, useRoutes } from '@/lib/hooks';
import { useGeofence } from '@/components/GeofenceMonitor';
import { useDriver } from '@/components/Providers';
import { Badge, Btn, Card, Sheet, Toggle } from '@/components/ui';

function Row2({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-semibold text-slate-900">{v}</dd>
    </div>
  );
}

export default function Profile() {
  const router = useRouter();
  const qc = useQueryClient();
  const { driver, status } = useDriver();
  const {
    enabled: geofenceOn,
    setEnabled: setGeofenceOn,
    fix,
    closest,
    detectorState,
    geoError,
    refreshGps,
  } = useGeofence();
  const me = useQuery({ queryKey: ['authme'], queryFn: () => cached<Row>('authme', () => api('/auth/me')) });
  const routes = useRoutes();
  const perm = useGeoPermission();
  const [testing, setTesting] = useState(false);
  const [testedOnce, setTestedOnce] = useState(false);
  const [out, setOut] = useState(false);
  const veh = pickRoute(routes.data?.data)?.vehicle;
  const unsynced = status.pending + status.attention;

  const effectivePerm = fix ? 'granted' : perm;

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    await db.cache.clear();
    qc.clear();
    router.replace('/login');
  }

  async function testGps() {
    setTesting(true);
    try {
      await refreshGps();
      setTestedOnce(true);
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Profile</h1>

      <Card className="flex items-center gap-3.5 bg-gradient-to-br from-[#F0FDFA] to-white">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0F766E] text-white">
          <User size={24} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold text-slate-900">Driver {driver.employee_code}</p>
          <p className="truncate text-xs text-slate-500">{me.data?.data.email ?? '—'}</p>
        </div>
        <Badge tone={driver.is_active ? 'ok' : 'bad'}>{driver.is_active ? 'active' : 'inactive'}</Badge>
      </Card>

      <Card>
        <dl className="divide-y divide-slate-100">
          <Row2 k="Employee code" v={driver.employee_code} />
          <Row2 k="Contact" v={driver.contact_number} />
          <Row2 k="Licence expiry" v={format(new Date(driver.license_expiry_date), 'd MMM yyyy')} />
          <Row2 k="Vehicle today" v={veh ? `${veh.plate_number} · ${veh.vehicle_type}` : '—'} />
        </dl>
      </Card>

      <Card className="space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Radar size={18} className="text-[#0F766E]" aria-hidden />
            <h2>Location &amp; Zero-Scan Pickup</h2>
          </div>
          <Badge tone={effectivePerm === 'granted' ? 'ok' : effectivePerm === 'denied' ? 'bad' : 'warn'}>
            {effectivePerm}
          </Badge>
        </div>

        <p className="text-xs leading-relaxed text-slate-600">
          While the app is open, GPS geofencing detects when you stay near a container (65 m, 45 s) to auto-mark arrival and pop up 1-tap pickup without scanning. Phones pause browser GPS when locked or closed.
        </p>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Auto-detect nearby containers</p>
            <p className="text-xs text-slate-500">State: {detectorState.replace('_', ' ')}</p>
          </div>
          <Toggle checked={geofenceOn} onChange={setGeofenceOn} label="Auto-detect nearby containers" />
        </div>

        {geoError && <p className="rounded-xl bg-amber-50 p-2.5 text-xs font-medium text-amber-900">{geoError}</p>}

        <Btn v="ghost" disabled={testing} onClick={testGps}>
          <LocateFixed size={17} aria-hidden />
          {testing ? 'Checking GPS…' : fix ? 'Refresh GPS fix' : 'Allow & Test GPS'}
        </Btn>

        {testedOnce && !fix && !geoError && (
          <p className="text-xs font-medium text-red-700">No location received. Check browser permission and device GPS.</p>
        )}

        {fix && (
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
            <p className="font-semibold">
              Live fix: {fix.latitude.toFixed(5)}, {fix.longitude.toFixed(5)} (±{Math.round(fix.accuracy)} m)
            </p>
            {closest && (
              <p className="text-[#0F766E] font-medium">
                Nearest stop: {closest.containerCode} · {formatDistance(closest.distanceM)} away
              </p>
            )}
          </div>
        )}
      </Card>

      <Card className="space-y-2 text-xs text-slate-600">
        <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
          <Smartphone size={17} className="text-[#0F766E]" aria-hidden />
          <h2>Install on your phone</h2>
        </div>
        <p>
          <strong>Android (Chrome):</strong> tap the ⋮ menu, then &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;.
        </p>
        <p>
          <strong>iPhone (Safari):</strong> tap the Share button, then &ldquo;Add to Home Screen&rdquo;. Must be opened in Safari.
        </p>
        <p className="text-slate-400">Open every main screen once while online so it also works offline.</p>
      </Card>

      <Btn v="danger" onClick={() => (unsynced ? setOut(true) : signOut())}>
        <LogOut size={17} aria-hidden /> Sign out
      </Btn>

      {out && (
        <Sheet title="Unsynced records" onClose={() => setOut(false)}>
          <p className="mb-4 text-sm text-slate-600">
            {unsynced} record(s) are not confirmed by the server yet. They stay on this phone and sync when you sign in again with this account.
          </p>
          <div className="space-y-3">
            <Btn v="danger" onClick={signOut}>
              Sign out anyway
            </Btn>
            <Btn v="ghost" onClick={() => setOut(false)}>
              Stay signed in
            </Btn>
          </div>
        </Sheet>
      )}
    </>
  );
}
