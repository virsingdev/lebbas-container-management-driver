import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const has = req.cookies.get('lcd_rt');
  const p = req.nextUrl.pathname;
  if (!has && !p.startsWith('/login')) return NextResponse.redirect(new URL('/login', req.url));
  if (has && p === '/login') return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.next();
}
export const config = { matcher: ['/((?!api|_next|favicon.ico|sw.js|manifest.webmanifest|icons|offline.html).*)'] };
