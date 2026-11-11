const PREFIX = '/place-images/assets/';
const MAX_BYTES = 5 * 1024 * 1024;
const failure = status => new Response(null, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

// This is a deliberately public namespace, separate from every protected photo
// and video key. No upstream URL, caller-selected bucket/key, or auth fallback.
export async function placeImageRequest(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(PREFIX)) return null;
  const match = url.pathname.slice(PREFIX.length).match(/^v1\/([a-f0-9]{64})\.webp$/);
  if (!match || url.search) return failure(404);
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { 'Cache-Control': 'no-store', Allow: 'GET, HEAD' } });
  const key = `places/v1/${match[1]}.webp`, etag = `"${match[1]}"`;
  const unchanged = (request.headers.get('If-None-Match') || '').split(',').some(tag => tag.trim() === '*' || tag.trim().replace(/^W\//, '') === etag);
  const object = request.method === 'HEAD' || unchanged ? await env.PHOTOS.head(key) : await env.PHOTOS.get(key);
  if (!object) return failure(404);
  if (object.httpMetadata?.contentType !== 'image/webp' || !Number.isInteger(object.size) || object.size < 1 || object.size > MAX_BYTES) throw new Error('Invalid public venue image');
  const headers = {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': 'image/webp', 'Content-Length': String(object.size),
    'Content-Disposition': 'inline', ETag: etag,
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Access-Control-Allow-Origin': '*',
  };
  return new Response(request.method === 'HEAD' || unchanged ? null : object.body, { status: unchanged ? 304 : 200, headers });
}
