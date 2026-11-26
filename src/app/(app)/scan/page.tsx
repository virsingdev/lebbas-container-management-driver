'use client';
import { useState } from 'react';
import Link from 'next/link';
import { QrCode, Search } from 'lucide-react';
import { api, ApiError, type Row } from '@/lib/api';
import { useRoutes } from '@/lib/hooks';
import { QrScanner } from '@/components/QrScanner';
import { Btn, Card, ErrorBox, inputCls } from '@/components/ui';

export default function Scan() {
  const routes = useRoutes();
  const [on, setOn] = useState(false);
  const [manual, setManual] = useState('');
  const [c, setC] = useState<Row | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup(raw: string) {
    setOn(false);
    setBusy(true);
    setErr(null);
    setC(null);
    const code = raw.trim().split('/').pop() ?? raw.trim();
    try {
      setC(await api(`/containers/qr/${encodeURIComponent(code)}`));
    } catch (e) {
      setErr(
        e instanceof ApiError && e.status === 404
          ? new Error('No container found for that code.')
          : e instanceof Error
            ? new Error(navigator.onLine ? e.message : 'You are offline. Lookup needs a connection.')
            : new Error('Lookup failed.')
      );
    } finally {
      setBusy(false);
    }
  }

  const stop =
    c &&
    routes.data?.data
      .flatMap((r) => r.stops.map((s: Row) => ({ r, s })))
      .find((x) => x.s.container_id === c.id);

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">QR Lookup</h1>
        <p className="text-xs text-slate-500">
          Optional manual scan if GPS geofencing isn&apos;t used at a container.
        </p>
      </div>

      {on ? (
        <QrScanner onCode={lookup} onClose={() => setOn(false)} />
      ) : (
        <Btn onClick={() => setOn(true)}>
          <QrCode size={18} aria-hidden /> Scan QR code
        </Btn>
      )}

      <Card className="space-y-2.5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Or enter code manually</p>
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder="Container QR code"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <Btn className="!w-24" v="ghost" disabled={!manual.trim() || busy} onClick={() => lookup(manual)}>
            <Search size={16} aria-hidden /> Find
          </Btn>
        </div>
      </Card>

      {err && <ErrorBox error={err} />}

      {c && (
        <Card className="space-y-2">
          <h2 className="text-xl font-extrabold text-slate-900">{c.container_code}</h2>
          <p className="font-medium text-slate-800">{c.location_name}</p>
          {c.address && <p className="text-sm text-slate-500">{c.address}</p>}
          <p className="text-xs text-slate-600">
            Status: <span className="font-bold capitalize">{c.status}</span>
          </p>
          {stop ? (
            <Link
              href={`/stop?r=${stop.r.id}&s=${stop.s.id}`}
              className="mt-2 flex min-h-[48px] items-center justify-center rounded-2xl bg-[#0F766E] font-bold text-white"
            >
              Open this stop
            </Link>
          ) : (
            <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-900">
              This container is not on any of your routes. Do not record a collection for it.
            </p>
          )}
        </Card>
      )}
    </>
  );
}
