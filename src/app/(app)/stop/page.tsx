'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, Navigation, QrCode } from 'lucide-react';
import { type Row, uid } from '@/lib/api';
import { getFix } from '@/lib/geo';
import { DONE, useOverlay, useRoutes } from '@/lib/hooks';
import { enqueue } from '@/lib/sync';
import { QrScanner } from '@/components/QrScanner';
import { Badge, Btn, Card, ErrorBox, Sheet, Skeleton, inputCls } from '@/components/ui';

const matches = (scan: string, qr: string) => { const s = scan.trim(); return s === qr || s.endsWith('/' + qr); };

function Stop() {
  const sp = useSearchParams(); const router = useRouter();
  const routeId = sp.get('r') ?? ''; const stopId = sp.get('s') ?? '';
  const routes = useRoutes(); const ov = useOverlay();
  const [verified, setVerified] = useState(false); const [scan, setScan] = useState(false); const [manual, setManual] = useState(''); const [vErr, setVErr] = useState('');
  const [w, setW] = useState(''); const [bags, setBags] = useState(''); const [notes, setNotes] = useState('');
  const [reason, setReason] = useState<null | 'skipped' | 'failed'>(null); const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const route: Row | undefined = routes.data?.data.find((r) => r.id === routeId);
  const stop: Row | undefined = route?.stops.find((s: Row) => s.id === stopId);
  if (routes.isLoading) return <Skeleton rows={2} />;
  if (!route || !stop) return <ErrorBox error={new Error('This stop is not in your assigned routes.')} />;
  const c: Row = stop.container; const pend = ov.get(stop.id); const eff: string = pend?.status ?? stop.status; const closed = DONE.includes(eff);
  const nav = c.latitude && c.longitude ? `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}&travelmode=driving` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address ?? c.location_name)}`;

  function check(code: string) {
    if (matches(code, c.qr_code)) { setVerified(true); setScan(false); setVErr(''); toast.success('Container verified'); }
    else { setScan(false); setVerified(false); setVErr(`Wrong container. This stop is ${c.container_code}. Scanned: ${code.slice(0, 40)}`); }
  }
  async function send(payload: Record<string, unknown>, label: string, gps = true) {
    if (busy) return; setBusy(true);
    try {
      const id = uid(); const f = gps ? await getFix(6000) : null;
      await enqueue({ id, type: 'route_stop_status_update', routeId, stopId, label: `${label} ${c.container_code}`, payload: { ...payload, ...(f ? { latitude: f.latitude, longitude: f.longitude, gps_accuracy_meters: f.accuracy } : {}), sync_idempotency_key: id } });
      toast.success('Saved on this phone. Syncing…'); router.push('/route');
    } finally { setBusy(false); }
  }
  const wn = Number(w); const wOk = w !== '' && wn > 0;
  return (
    <>
      <Link href="/route" className="text-sm font-semibold text-[#0F766E]">← Back to route</Link>
      <Card className="space-y-2">
        <div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">Stop {stop.sequence_number}</p><h1 className="text-2xl font-bold">{c.container_code}</h1></div><div className="text-right"><Badge>{eff}</Badge>{pend && <p className="mt-1 text-[11px] font-semibold text-amber-700">pending sync</p>}</div></div>
        <p className="font-medium">{c.location_name}</p>{c.address && <p className="text-sm text-slate-500">{c.address}</p>}
        {c.capacity_kg && <p className="text-sm text-slate-500">Capacity {c.capacity_kg} kg</p>}
        <a href={nav} target="_blank" rel="noreferrer" className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-[#0F766E] font-semibold text-[#0F766E]"><Navigation size={20} aria-hidden /> Navigate</a>
      </Card>
      {pend?.op.status === 'failed' || pend?.op.status === 'conflict' ? <ErrorBox error={new Error(`Last update was not accepted: ${pend.op.error ?? ''} See History to retry.`)} /> : null}
      {closed ? (
        <Card className="space-y-1"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="text-emerald-600" aria-hidden /> This stop is {eff}.</p>
          {stop.collected_weight_kg && <p className="text-sm text-slate-600">Weight: {stop.collected_weight_kg} kg</p>}{stop.failure_reason && <p className="text-sm text-slate-600">Reason: {stop.failure_reason}</p>}</Card>
      ) : (
        <>
          {(eff === 'pending') && <Btn v="ghost" disabled={busy} onClick={() => send({ status: 'en_route' }, 'On the way to', false)}>I&apos;m on my way</Btn>}
          {(eff === 'pending' || eff === 'en_route') && <Btn v="ghost" disabled={busy} onClick={() => send({ status: 'arrived' }, 'Arrived at')}>I&apos;ve arrived</Btn>}
          <Card className="space-y-3">
            <h2 className="font-semibold">1. Verify container</h2>
            {verified ? <p className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 aria-hidden /> Verified {c.container_code}</p> : (
              <>
                <Btn v="ghost" onClick={() => setScan(true)}><QrCode aria-hidden /> Scan QR code</Btn>
                <div className="flex gap-2"><input className={inputCls} placeholder="Or type the QR code" value={manual} onChange={(e) => setManual(e.target.value)} /><Btn className="!w-28" v="ghost" disabled={!manual.trim()} onClick={() => check(manual)}>Check</Btn></div>
                {vErr && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{vErr}</p>}
              </>)}
            {scan && <QrScanner onCode={check} onClose={() => setScan(false)} />}
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold">2. Record collection</h2>
            <label className="block text-sm font-medium">Weight (kg) *<input className={inputCls} type="number" inputMode="decimal" min="0" step="0.01" value={w} onChange={(e) => setW(e.target.value)} aria-invalid={w !== '' && !wOk} /></label>
            {w !== '' && !wOk && <p className="text-sm text-red-700">Weight must be more than 0.</p>}
            <label className="block text-sm font-medium">Number of bags<input className={inputCls} type="number" inputMode="numeric" min="0" step="1" value={bags} onChange={(e) => setBags(e.target.value)} /></label>
            <label className="block text-sm font-medium">Notes<textarea className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            <Btn disabled={!verified || !wOk || busy} onClick={() => send({ status: 'completed', collected_weight_kg: wn, bag_count: Number(bags || 0), collected_at: new Date().toISOString(), ...(notes.trim() ? { notes: notes.trim() } : {}) }, 'Collected')}>{busy ? 'Saving…' : 'Save collection'}</Btn>
            {!verified && <p className="text-xs text-slate-500">Verify the container first so the collection is never saved for the wrong container.</p>}
            <p className="text-xs text-slate-500">Photos are not available yet: the server has no photo upload endpoint.</p>
          </Card>
          <div className="grid grid-cols-2 gap-3"><Btn v="warn" onClick={() => setReason('skipped')}>Skip stop</Btn><Btn v="danger" onClick={() => setReason('failed')}>Can&apos;t collect</Btn></div>
        </>)}
      {reason && <Sheet title={reason === 'skipped' ? 'Skip this stop' : 'Could not collect'} onClose={() => setReason(null)}>
        <label className="mb-4 block text-sm font-medium">Reason *<textarea className={inputCls} rows={3} value={why} onChange={(e) => setWhy(e.target.value)} /></label>
        <div className="space-y-3"><Btn v={reason === 'skipped' ? 'warn' : 'danger'} disabled={!why.trim() || busy} onClick={() => send({ status: reason, failure_reason: why.trim() }, reason === 'skipped' ? 'Skipped' : 'Failed')}>Confirm</Btn><Btn v="ghost" onClick={() => setReason(null)}>Cancel</Btn></div></Sheet>}
    </>
  );
}
export default function Page() { return <Suspense fallback={<Skeleton rows={2} />}><Stop /></Suspense>; }
