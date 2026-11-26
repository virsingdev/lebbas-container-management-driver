'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Row } from '@/lib/api';
import { cached } from '@/lib/cached';
import { db } from '@/lib/db';
import { getFix, useGeoPermission, type Fix } from '@/lib/geo';
import { pickRoute, useRoutes } from '@/lib/hooks';
import { useGeofence } from '@/components/GeofenceMonitor';
import { useDriver } from '@/components/Providers';
import { Badge, Btn, Card, Sheet } from '@/components/ui';

function Row2({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

export default function Profile() {
  const router = useRouter();
  const qc = useQueryClient();
  const { driver, status } = useDriver();
  const { enabled: geofenceOn, setEnabled: setGeofenceOn, geoError } = useGeofence();
  const me = useQuery({ queryKey: ['authme'], queryFn: () => cached<Row>('authme', () => api('/auth/me')) });
  const routes = useRoutes();
  const perm = useGeoPermission();
  const [fix, setFix] = useState<Fix | null | undefined>(undefined);
  const [out, setOut] = useState(false);
  const veh = pickRoute(routes.data?.data)?.vehicle;
  const unsynced = status.pending + status.attention;

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    await db.cache.clear();
    qc.clear();
    router.replace('/login');
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      <Card>
        <dl className="divide-y divide-slate-100">
          <Row2 k="Employee code" v={driver.employee_code} />
          <Row2 k="Email" v={me.data?.data.email ?? '—'} />
          <Row2 k="Contact" v={driver.contact_number} />
          <Row2 k="Licence expiry" v={format(new Date(driver.license_expiry_date), 'd MMM yyyy')} />
          <Row2 k="Vehicle today" v={veh ? `${veh.plate_number} · ${veh.vehicle_type}` : '—'} />
          <Row2 k="Account" v={<Badge tone={driver.is_active ? 'ok' : 'bad'}>{driver.is_active ? 'active' : 'inactive'}</Badge>} />
        </dl>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">Location &amp; Zero-Scan Pickup</h2>
        <p className="text-sm text-slate-600">
          Permission: <span className="font-semibold capitalize">{perm}</span>. While the app is open, GPS geofencing detects when you stay near a container (65 m, 45 s) to auto-mark arrival and prompt 1-tap pickup without scanning. Phones pause browser GPS when locked or closed.
        </p>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm font-medium">
          <span>Auto-detect nearby containers</span>
          <input
            type="checkbox"
            checked={geofenceOn}
            onChange={(e) => setGeofenceOn(e.target.checked)}
            className="h-5 w-5 accent-[#0F766E]"
          />
        </label>
        {geoError && <p className="text-sm text-amber-800">{geoError}</p>}
        <Btn v="ghost" onClick={async () => setFix(await getFix(10000))}>Test GPS</Btn>
        {fix === null && <p className="text-sm text-red-700">No location. Check your browser permission and that GPS is on.</p>}
        {fix && <p className="text-sm text-slate-600">{fix.latitude.toFixed(5)}, {fix.longitude.toFixed(5)} · ±{Math.round(fix.accuracy)} m</p>}
      </Card>
      <Card className="space-y-2 text-sm">
        <h2 className="font-semibold">Install on your phone</h2>
        <p><strong>Android (Chrome):</strong> tap the ⋮ menu, then &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;.</p>
        <p><strong>iPhone (Safari):</strong> tap the Share button, then &ldquo;Add to Home Screen&rdquo;. It must be opened in Safari.</p>
        <p className="text-slate-500">Open every main screen once while online so it also works offline.</p>
      </Card>
      <Btn v="danger" onClick={() => (unsynced ? setOut(true) : signOut())}>Sign out</Btn>
      {out && (
        <Sheet title="Unsynced records" onClose={() => setOut(false)}>
          <p className="mb-4 text-slate-600">{unsynced} record(s) are not confirmed by the server yet. They stay on this phone and sync when you sign in again with this account.</p>
          <div className="space-y-3">
            <Btn v="danger" onClick={signOut}>Sign out anyway</Btn>
            <Btn v="ghost" onClick={() => setOut(false)}>Stay signed in</Btn>
          </div>
        </Sheet>
      )}
    </>
  );
}
