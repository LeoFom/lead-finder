import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
const allowed = new Set([
  'auth',
  'workspace',
  'offline-snapshot',
  'countries',
  'cities',
  'search-profiles',
  'businesses',
  'search-runs',
  'exports',
]);
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!allowed.has(path[0] ?? '') || path.some((p) => !/^[a-zA-Z0-9-]+$/.test(p)))
    return Response.json({ message: 'Маршрут не знайдено' }, { status: 404 });
  const base = process.env.API_BASE_URL;
  const key = process.env.API_PROXY_KEY;
  if (!base || !key) return Response.json({ message: 'API ще не налаштовано' }, { status: 503 });
  const url = new URL(base);
  if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production')
    return Response.json({ message: 'Некоректна конфігурація API' }, { status: 503 });
  const origin = request.headers.get('origin');
  if (request.method !== 'GET' && origin !== request.nextUrl.origin)
    return Response.json({ message: 'Недозволене походження запиту' }, { status: 403 });
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 65536) return Response.json({ message: 'Запит завеликий' }, { status: 413 });
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
  if (body && Buffer.byteLength(body) > 65536)
    return Response.json({ message: 'Запит завеликий' }, { status: 413 });
  try {
    const upstream = await fetch(
      new URL('/api/v1/' + path.join('/') + request.nextUrl.search, url),
      {
        method: request.method,
        headers: {
          'content-type': 'application/json',
          'x-api-proxy-key': key,
          cookie: request.headers.get('cookie') ?? '',
          origin: origin ?? request.nextUrl.origin,
          'idempotency-key': request.headers.get('idempotency-key') ?? '',
          'x-client-ip': request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown',
        },
        ...(body !== undefined ? { body } : {}),
        redirect: 'error',
        signal: AbortSignal.timeout(60000),
        cache: 'no-store',
      },
    );
    const headers = new Headers({ 'cache-control': 'no-store' });
    for (const name of ['content-type', 'content-disposition', 'set-cookie']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return Response.json(
      { message: 'API запускається або тимчасово недоступне. Повторіть запит за хвилину.' },
      { status: 503 },
    );
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH };
