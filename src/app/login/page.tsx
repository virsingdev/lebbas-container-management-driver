'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Package } from 'lucide-react';
import { Providers } from '@/components/Providers';
import { Btn, inputCls } from '@/components/ui';

function Login() {
  const router = useRouter();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [show, setShow] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (location.search.includes('expired')) setErr('Your session expired. Sign in again. Pending records stay on this phone.'); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).catch(() => null);
    if (r?.ok) { router.replace('/'); router.refresh(); return; }
    setErr(r ? ((await r.json().catch(() => ({}))) as { detail?: string }).detail ?? 'Sign-in failed.' : 'No connection. You need internet to sign in.'); setBusy(false);
  }
  return (
    <main className="flex min-h-screen flex-col bg-[#134E4A]">
      <div className="flex flex-1 flex-col items-center justify-center px-6 pt-[env(safe-area-inset-top)] text-white">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#14B8A6] text-[#134E4A]"><Package size={34} /></span>
        <h1 className="mt-4 text-3xl font-bold tracking-wide">LEBBAS</h1><p className="text-teal-200">Container Driver</p>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <h2 className="text-xl font-bold">Sign in</h2>
        {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{err}</p>}
        <label className="block text-sm font-medium">Email<input className={`${inputCls} mt-1`} type="email" inputMode="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="block text-sm font-medium">Password<span className="relative mt-1 block"><input className={`${inputCls} pr-14`} type={show ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-3.5 text-slate-500">{show ? <EyeOff /> : <Eye />}</button></span></label>
        <Btn type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Btn>
      </form>
    </main>
  );
}
export default function Page() { return <Providers auth={false}><Login /></Providers>; }
