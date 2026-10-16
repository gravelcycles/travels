export function photoAssetDetails(key) {
  const match = key.match(/^v1\/([a-f0-9]{64})\.(webp|avif)$/);
  return match ? { contentType: `image/${match[2]}`, etag: `"${match[1]}"` } : null;
}

// Only called through the internal PhotoCache entrypoint, after gateway auth.
// Content-addressed keys are immutable; errors must never enter the cache.
export async function cachedPhoto(request, env) {
  const url = new URL(request.url);
  const prefix = '/private-photos/assets/';
  const key = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : '';
  const asset = photoAssetDetails(key);
  if (!asset || url.search || !['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const object = request.method === 'HEAD' ? await env.PHOTOS.head(key) : await env.PHOTOS.get(key);
  if (!object) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (object.httpMetadata?.contentType !== asset.contentType) throw new Error('Unexpected object type');
  return new Response(request.method === 'HEAD' ? null : object.body, { headers: {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': asset.contentType, 'Content-Length': String(object.size),
  } });
}
