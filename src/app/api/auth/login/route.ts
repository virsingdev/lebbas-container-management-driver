import { NextRequest, NextResponse } from 'next/server';
import { API, setTokens, type Tokens } from '@/lib/server';

export async function POST(req: NextRequest) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: await req.text(), cache: 'no-store' }).catch(() => null);
  if (!r) return NextResponse.json({ detail: 'Cannot reach the server. Check your connection.' }, { status: 503 });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const d = (data as { detail?: unknown }).detail;
    return NextResponse.json({ detail: r.status === 422 ? 'Enter a valid email and password.' : typeof d === 'string' ? d : 'Sign-in failed.' }, { status: r.status });
  }
  const res = NextResponse.json({ ok: true });
  setTokens(res, data as Tokens);
  return res;
}
