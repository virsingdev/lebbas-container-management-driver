'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, MapPin, Package, ShieldCheck } from 'lucide-react';
import { Providers } from '@/components/Providers';
import { Btn, inputCls } from '@/components/ui';

function Login() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const expiredMsg = sp.get('expired')
    ? 'Your session expired. Sign in again. Pending records stay on this phone.'
    : '';
  const shownErr = err || expiredMsg;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    if (r?.ok) {
      router.replace('/');
      router.refresh();
      return;
    }
    setErr(
      r
        ? ((await r.json().catch(() => ({}))) as { detail?: string }).detail ?? 'Sign-in failed.'
        : 'No connection. You need internet to sign in.'
    );
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[460px] flex-col bg-gradient-to-b from-[#0F766E] via-[#134E4A] to-[#0B3B37] sm:border-x sm:border-slate-200/30 sm:shadow-2xl">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 pt-[calc(2.5rem+env(safe-area-inset-top))] text-center text-white">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-teal-200 ring-1 ring-white/25 shadow-lg">
          <Package size={34} aria-hidden />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">LEBBAS</h1>
        <p className="mt-1 text-sm font-medium text-teal-100">Container Driver App</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-teal-100/90">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
            <MapPin size={12} aria-hidden /> Auto-geofence pickup
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
            <ShieldCheck size={12} aria-hidden /> Offline sync ready
          </span>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-t-3xl bg-white p-6 pb-[calc(1.75rem+env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div>
          <h2 className="text-xl font-bold text-slate-900">Driver sign in</h2>
          <p className="mt-0.5 text-sm text-slate-500">Use your LEBBAS field driver account</p>
        </div>
        {shownErr && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {shownErr}
          </p>
        )}
        <label className="block text-sm font-semibold text-slate-700">
          Email
          <input
            className={`${inputCls} mt-1.5`}
            type="email"
            inputMode="email"
            placeholder="driver@lebbas.com"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Password
          <span className="relative mt-1.5 block">
            <input
              className={`${inputCls} pr-12`}
              type={show ? 'text' : 'password'}
              placeholder="Enter password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:text-slate-700"
            >
              {show ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </span>
        </label>
        <Btn type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Btn>
      </form>
    </main>
  );
}

export default function Page() {
  return (
    <Providers auth={false}>
      <Suspense fallback={<main className="mx-auto min-h-[100dvh] max-w-[460px] bg-[#134E4A]" />}>
        <Login />
      </Suspense>
    </Providers>
  );
}
