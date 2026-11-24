import { NextRequest, NextResponse } from 'next/server';
import { API, clearTokens, refresh, setTokens, type Tokens } from '@/lib/server';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function handle(req: NextRequest, { params }: RouteContext) {
  const { path } = await params;

  const url = `${API}/${path.join('/')}${req.nextUrl.search}`;
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();

  const rt = req.cookies.get('lcd_rt')?.value;
  let at = req.cookies.get('lcd_at')?.value;
  let fresh: Tokens | null = null;

  const call = (token?: string) =>
    fetch(url, {
      method: req.method,
      body,
      cache: 'no-store',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  try {
    if (!at && rt) {
      fresh = await refresh(rt);
      at = fresh?.access_token;
    }

    let r = await call(at);

    if (r.status === 401 && rt && !fresh) {
      fresh = await refresh(rt);
      if (fresh) r = await call(fresh.access_token);
    }

    const responseText = r.status === 204 ? null : await r.text();

    const res = new NextResponse(responseText, {
      status: r.status,
      headers: {
        'Content-Type': r.headers.get('content-type') ?? 'application/json',
      },
    });

    if (fresh) setTokens(res, fresh);
    else if (r.status === 401) clearTokens(res);

    return res;
  } catch {
    return NextResponse.json({ detail: 'Server unreachable' }, { status: 503 });
  }
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
