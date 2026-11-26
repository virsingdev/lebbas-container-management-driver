'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, MapPin, Navigation, QrCode } from 'lucide-react';
import { type Row, uid } from '@/lib/api';
import { distanceMeters, formatDistance, getFix } from '@/lib/geo';
import { hasValidCoords } from '@/lib/geofence';
import { DONE, useOverlay, useRoutes } from '@/lib/hooks';
import { enqueue } from '@/lib/sync';
import { useGeofence } from '@/components/GeofenceMonitor';
import { QrScanner } from '@/components/QrScanner';
import { Badge, Btn, Card, ErrorBox, Sheet, Skeleton, cn, inputCls } from '@/components/ui';

const matches = (scan: string, qr: string) => {
  const s = scan.trim();
  return s === qr || s.endsWith('/' + qr);
};

const QUICK_WEIGHTS = [10, 20, 30, 50];
const QUICK_BAGS = [1, 2, 3, 5];

function Stop() {
  const sp = useSearchParams();
  const router = useRouter();
  const routeId = sp.get('r') ?? '';
  const stopId = sp.get('s') ?? '';
  const routes = useRoutes();
  const ov = useOverlay();
  const { fix, nearby } = useGeofence();

  const [verified, setVerified] = useState(false);
  const [scan, setScan] = useState(false);
  const [manual, setManual] = useState('');
  const [vErr, setVErr] = useState('');
  const [w, setW] = useState('');
  const [bags, setBags] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState<null | 'skipped' | 'failed'>(null);
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);

  const route: Row | undefined = routes.data?.data.find((r) => r.id === routeId);
  const stop: Row | undefined = route?.stops.find((s: Row) => s.id === stopId);

  if (routes.isLoading) return <Skeleton rows={2} />;
  if (!route || !stop) return <ErrorBox error={new Error('This stop is not in your assigned routes.')} />;

  const c: Row = stop.container;
  const pend = ov.get(stop.id);
  const eff: string = pend?.status ?? stop.status;
  const closed = DONE.includes(eff);
  const geofenceVerified =
    Boolean(nearby && nearby.stopId === stop.id && nearby.dwelled) ||
    (sp.get('geofence') === '1' && eff === 'arrived');
  const isVerified = verified || geofenceVerified;

  const coords = hasValidCoords(stop);
  const dist = fix && coords ? distanceMeters(fix.latitude, fix.longitude, coords.lat, coords.lng) : null;
  const nav = coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address ?? c.location_name)}`;

  function check(code: string) {
    if (matches(code, c.qr_code)) {
      setVerified(true);
      setScan(false);
      setVErr('');
      toast.success('Container verified');
    } else {
      setScan(false);
      setVerified(false);
      setVErr(`Wrong container. This stop is ${c.container_code}. Scanned: ${code.slice(0, 40)}`);
    }
  }

  async function send(payload: Record<string, unknown>, label: string, gps = true) {
    if (busy) return;
    setBusy(true);
    try {
      const id = uid();
      const f = gps ? fix ?? (await getFix(6000)) : null;
      await enqueue({
        id,
        type: 'route_stop_status_update',
        routeId,
        stopId,
        label: `${label} ${c.container_code}`,
        payload: {
          ...payload,
          ...(f ? { latitude: f.latitude, longitude: f.longitude, gps_accuracy_meters: f.accuracy } : {}),
          sync_idempotency_key: id,
        },
      });
      toast.success('Saved on this phone. Syncing…');
      router.push('/route');
    } finally {
      setBusy(false);
    }
  }

  const wn = Number(w);
  const wOk = w !== '' && wn > 0;

  return (
    <>
      <Link href="/route" className="inline-flex items-center gap-1 text-sm font-bold text-[#0F766E]">
        ← Back to route
      </Link>

      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Stop {stop.sequence_number}
              {dist !== null ? ` · ${formatDistance(dist)} away` : ''}
            </p>
            <h1 className="text-2xl font-extrabold text-slate-900">{c.container_code}</h1>
          </div>
          <div className="text-right">
            <Badge>{eff}</Badge>
            {pend && <p className="mt-1 text-[11px] font-semibold text-amber-700">pending sync</p>}
          </div>
        </div>
        <div>
          <p className="font-semibold text-slate-800">{c.location_name}</p>
          {c.address && <p className="text-sm text-slate-500">{c.address}</p>}
          {c.capacity_kg && <p className="mt-1 text-xs font-medium text-slate-500">Capacity: {c.capacity_kg} kg</p>}
        </div>
        <a
          href={nav}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-teal-200 bg-[#F0FDFA] font-bold text-[#0F766E] active:bg-teal-100"
        >
          <Navigation size={18} aria-hidden /> Navigate in Maps
        </a>
      </Card>

      {pend?.op.status === 'failed' || pend?.op.status === 'conflict' ? (
        <ErrorBox error={new Error(`Last update was not accepted: ${pend.op.error ?? ''} See History to retry.`)} />
      ) : null}

      {closed ? (
        <Card className="space-y-1.5">
          <p className="flex items-center gap-2 font-bold text-slate-900">
            <CheckCircle2 className="text-emerald-600" aria-hidden /> This stop is {eff}.
          </p>
          {stop.collected_weight_kg && <p className="text-sm text-slate-600">Weight: {stop.collected_weight_kg} kg</p>}
          {stop.failure_reason && <p className="text-sm text-slate-600">Reason: {stop.failure_reason}</p>}
        </Card>
      ) : (
        <>
          {(eff === 'pending' || eff === 'en_route') && (
            <div className="grid grid-cols-2 gap-2.5">
              {eff === 'pending' && (
                <Btn v="ghost" disabled={busy} onClick={() => send({ status: 'en_route' }, 'On the way to', false)}>
                  On my way
                </Btn>
              )}
              <Btn
                v="ghost"
                className={eff === 'en_route' ? 'col-span-2' : undefined}
                disabled={busy}
                onClick={() => send({ status: 'arrived' }, 'Arrived at')}
              >
                I&apos;ve arrived
              </Btn>
            </div>
          )}

          <Card className="space-y-3">
            <h2 className="font-bold text-slate-900">1. Verify container</h2>
            {verified ? (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
                <CheckCircle2 size={18} aria-hidden /> Verified {c.container_code} (QR)
              </p>
            ) : geofenceVerified ? (
              <p className="flex items-center gap-2 rounded-xl border border-teal-200 bg-[#F0FDFA] p-3 text-sm font-bold text-[#0F766E]">
                <MapPin size={18} aria-hidden /> Verified by GPS geofence
                {nearby && nearby.stopId === stop.id ? ` (${formatDistance(nearby.distanceM)})` : ''}
              </p>
            ) : (
              <>
                <Btn v="ghost" onClick={() => setScan(true)}>
                  <QrCode size={18} aria-hidden /> Scan QR code
                </Btn>
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    placeholder="Or type the QR code"
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                  />
                  <Btn className="!w-24" v="ghost" disabled={!manual.trim()} onClick={() => check(manual)}>
                    Check
                  </Btn>
                </div>
                {vErr && (
                  <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                    {vErr}
                  </p>
                )}
              </>
            )}
            {scan && <QrScanner onCode={check} onClose={() => setScan(false)} />}
          </Card>

          <Card className="space-y-4">
            <h2 className="font-bold text-slate-900">2. Record collection</h2>
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Weight (kg) *
                <input
                  className={cn(inputCls, 'mt-1.5')}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Enter collected kg"
                  value={w}
                  onChange={(e) => setW(e.target.value)}
                  aria-invalid={w !== '' && !wOk}
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_WEIGHTS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setW(String(val))}
                    className={cn(
                      'rounded-xl border px-3 py-1.5 text-xs font-bold transition',
                      Number(w) === val
                        ? 'border-[#0F766E] bg-[#0F766E] text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    {val} kg
                  </button>
                ))}
              </div>
              {w !== '' && !wOk && <p className="mt-1 text-sm text-red-700">Weight must be more than 0.</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Number of bags
                <input
                  className={cn(inputCls, 'mt-1.5')}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="Optional"
                  value={bags}
                  onChange={(e) => setBags(e.target.value)}
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_BAGS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setBags(String(val))}
                    className={cn(
                      'rounded-xl border px-3 py-1.5 text-xs font-bold transition',
                      Number(bags) === val
                        ? 'border-[#0F766E] bg-[#0F766E] text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    {val} {val === 1 ? 'bag' : 'bags'}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-sm font-semibold text-slate-700">
              Notes
              <textarea
                className={cn(inputCls, 'mt-1.5 py-2.5')}
                rows={2}
                placeholder="Optional remarks"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

            <Btn
              disabled={!isVerified || !wOk || busy}
              onClick={() =>
                send(
                  {
                    status: 'completed',
                    collected_weight_kg: wn,
                    bag_count: Number(bags || 0),
                    collected_at: new Date().toISOString(),
                    ...(notes.trim() ? { notes: notes.trim() } : {}),
                  },
                  'Collected'
                )
              }
            >
              {busy ? 'Saving…' : 'Save collection'}
            </Btn>

            {!isVerified && (
              <p className="text-xs text-slate-500">
                Scan the QR code, enter it above, or stay near the container (65 m, 45 s) to verify automatically.
              </p>
            )}
            <p className="text-xs text-slate-400">Photos are not available yet: the server has no photo upload endpoint.</p>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Btn v="warn" onClick={() => setReason('skipped')}>
              Skip stop
            </Btn>
            <Btn v="danger" onClick={() => setReason('failed')}>
              Can&apos;t collect
            </Btn>
          </div>
        </>
      )}

      {reason && (
        <Sheet title={reason === 'skipped' ? 'Skip this stop' : 'Could not collect'} onClose={() => setReason(null)}>
          <label className="mb-4 block text-sm font-semibold text-slate-700">
            Reason *
            <textarea
              className={cn(inputCls, 'mt-1.5 py-2.5')}
              rows={3}
              value={why}
              onChange={(e) => setWhy(e.target.value)}
            />
          </label>
          <div className="space-y-3">
            <Btn
              v={reason === 'skipped' ? 'warn' : 'danger'}
              disabled={!why.trim() || busy}
              onClick={() =>
                send({ status: reason, failure_reason: why.trim() }, reason === 'skipped' ? 'Skipped' : 'Failed')
              }
            >
              Confirm
            </Btn>
            <Btn v="ghost" onClick={() => setReason(null)}>
              Cancel
            </Btn>
          </div>
        </Sheet>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={2} />}>
      <Stop />
    </Suspense>
  );
}
