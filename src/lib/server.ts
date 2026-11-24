import { NextResponse } from 'next/server';

export const API = process.env.API_BASE_URL ?? 'https://container-api.lebbas.com/api/v1';
export type Tokens = { access_token: string; refresh_token: string; expires_in: number };
const secure = process.env.NODE_ENV === 'production';
const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
// Distinct cookie names so the admin app on another localhost port does not collide.
export function setTokens(res: NextResponse, t: Tokens) {
  res.cookies.set('lcd_at', t.access_token, { ...base, maxAge: Math.max(t.expires_in, 60) });
  res.cookies.set('lcd_rt', t.refresh_token, { ...base, maxAge: 60 * 60 * 24 * 7 });
}
export function clearTokens(res: NextResponse) {
  res.cookies.set('lcd_at', '', { ...base, maxAge: 0 });
  res.cookies.set('lcd_rt', '', { ...base, maxAge: 0 });
}
const inflight = new Map<string, Promise<Tokens | null>>();
export function refresh(rt: string): Promise<Tokens | null> {
  const hit = inflight.get(rt);
  if (hit) return hit;
  const p = fetch(`${API}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: rt }), cache: 'no-store' })
    .then(async (r) => (r.ok ? ((await r.json()) as Tokens) : null)).catch(() => null);
  inflight.set(rt, p);
  setTimeout(() => inflight.delete(rt), 15000);
  return p;
}
