'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, ApiError, type Row } from '@/lib/api';
import { useRoutes } from '@/lib/hooks';
import { QrScanner } from '@/components/QrScanner';
import { Btn, Card, ErrorBox, inputCls } from '@/components/ui';

export default function Scan() {
  const routes = useRoutes();
  const [on, setOn] = useState(false); const [manual, setManual] = useState(''); const [c, setC] = useState<Row | null>(null); const [err, setErr] = useState<Error | null>(null); const [busy, setBusy] = useState(false);
  async function lookup(raw: string) {
    setOn(false); setBusy(true); setErr(null); setC(null);
    const code = raw.trim().split('/').pop() ?? raw.trim();
    try { setC(await api(`/containers/qr/${encodeURIComponent(code)}`)); }
    catch (e) { setErr(e instanceof ApiError && e.status === 404 ? new Error('No container found for that code.') : e instanceof Error ? new Error(navigator.onLine ? e.message : 'You are offline. Lookup needs a connection.') : new Error('Lookup failed.')); }
    finally { setBusy(false); }
  }
  const stop = c && routes.data?.data.flatMap((r) => r.stops.map((s: Row) => ({ r, s }))).find((x) => x.s.container_id === c.id);
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Scan container</h1>
      {on ? <QrScanner onCode={lookup} onClose={() => setOn(false)} /> : <Btn onClick={() => setOn(true)}>Scan QR code</Btn>}
      <div className="flex gap-2"><input className={inputCls} placeholder="Or type the QR code" value={manual} onChange={(e) => setManual(e.target.value)} /><Btn className="!w-28" v="ghost" disabled={!manual.trim() || busy} onClick={() => lookup(manual)}>Find</Btn></div>
      {err && <ErrorBox error={err} />}
      {c && <Card className="space-y-1"><h2 className="text-xl font-bold">{c.container_code}</h2><p>{c.location_name}</p>{c.address && <p className="text-sm text-slate-500">{c.address}</p>}<p className="text-sm">Status: <span className="font-semibold">{c.status}</span></p>
        {stop ? <Link href={`/stop?r=${stop.r.id}&s=${stop.s.id}`} className="mt-2 flex min-h-[52px] items-center justify-center rounded-2xl bg-[#0F766E] font-semibold text-white">Open this stop</Link> : <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This container is not on any of your routes. Do not record a collection for it.</p>}</Card>}
    </>
  );
}
