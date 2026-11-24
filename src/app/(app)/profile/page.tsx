'use client';
import { useState } from 'react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { api, type Row } from '@/lib/api';
import { cached } from '@/lib/cached';
import { db } from '@/lib/db';
import { getFix, useGeoPermission, type Fix } from '@/lib/geo';
import { pickRoute, useRoutes } from '@/lib/hooks';
import { useDriver } from '@/components/Providers';
import { Badge, Btn, Card, Sheet } from '@/components/ui';

export default function Profile() {
  const { driver, status } = useDriver();
  const me = useQuery({ queryKey: ['authme'], queryFn: () => cached<Row>('authme', () => api('/auth/me')) });
  const routes = useRoutes(); const perm = useGeoPermission();
  const [fix, setFix] = useState<Fix | null | undefined>(undefined); const [out, setOut] = useState(false);
  const veh = pickRoute(routes.data?.data)?.vehicle;
  const unsynced = status.pending + status.attention;
  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    await db.cache.clear(); location.href = '/login';
  }
  const Row2 = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-4 py-2 text-sm"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>;
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      <Card><dl className="divide-y divide-slate-100">
        <Row2 k="Employee code" v={driver.employee_code} /><Row2 k="Email" v={me.data?.data.email ?? '—'} /><Row2 k="Contact" v={driver.contact_number} />
        <Row2 k="Licence expiry" v={format(new Date(driver.license_expiry_date), 'd MMM yyyy')} /><Row2 k="Vehicle today" v={veh ? `${veh.plate_number} · ${veh.vehicle_type}` : '—'} />
        <Row2 k="Account" v={<Badge tone={driver.is_active ? 'ok' : 'bad'}>{driver.is_active ? 'active' : 'inactive'}</Badge>} /></dl></Card>
      <Card className="space-y-2"><h2 className="font-semibold">Location</h2>
        <p className="text-sm text-slate-600">Permission: <span className="font-semibold capitalize">{perm}</span>. Location is read when you save a stop, start a shift, or open the map. Phones may stop tracking when the app is closed or the screen is locked, so background tracking is not offered.</p>
        <Btn v="ghost" onClick={async () => setFix(await getFix(10000))}>Test GPS</Btn>
        {fix === null && <p className="text-sm text-red-700">No location. Check your browser permission and that GPS is on.</p>}
        {fix && <p className="text-sm text-slate-600">{fix.latitude.toFixed(5)}, {fix.longitude.toFixed(5)} · ±{Math.round(fix.accuracy)} m</p>}</Card>
      <Card className="space-y-2 text-sm"><h2 className="font-semibold">Install on your phone</h2>
        <p><strong>Android (Chrome):</strong> tap the ⋮ menu, then &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;.</p>
        <p><strong>iPhone (Safari):</strong> tap the Share button, then &ldquo;Add to Home Screen&rdquo;. It must be opened in Safari.</p>
        <p className="text-slate-500">Open every main screen once while online so it also works offline.</p></Card>
      <Btn v="danger" onClick={() => (unsynced ? setOut(true) : signOut())}>Sign out</Btn>
      {out && <Sheet title="Unsynced records" onClose={() => setOut(false)}><p className="mb-4 text-slate-600">{unsynced} record(s) are not confirmed by the server yet. They stay on this phone and sync when you sign in again with this account.</p><div className="space-y-3"><Btn v="danger" onClick={signOut}>Sign out anyway</Btn><Btn v="ghost" onClick={() => setOut(false)}>Stay signed in</Btn></div></Sheet>}
    </>
  );
}
