import { NextRequest, NextResponse } from 'next/server';
import { API, clearTokens } from '@/lib/server';

export async function POST(req: NextRequest) {
  const rt = req.cookies.get('lcd_rt')?.value;
  if (rt) await fetch(`${API}/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: rt }), cache: 'no-store' }).catch(() => null);
  const res = NextResponse.json({ ok: true });
  clearTokens(res);
  return res;
}
