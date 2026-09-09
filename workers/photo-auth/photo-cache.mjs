// Only called through the internal PhotoCache entrypoint, after gateway auth.
// Content-addressed keys are immutable; errors must never enter the cache.
export async function cachedPhoto(request, env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/private-photos\/assets\/(v1\/[a-f0-9]{64}\.webp)$/);
  if (!match || url.search || !['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const object = request.method === 'HEAD' ? await env.PHOTOS.head(match[1]) : await env.PHOTOS.get(match[1]);
  if (!object) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (object.httpMetadata?.contentType !== 'image/webp') throw new Error('Unexpected object type');
  return new Response(request.method === 'HEAD' ? null : object.body, { headers: {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': 'image/webp', 'Content-Length': String(object.size),
  } });
}
