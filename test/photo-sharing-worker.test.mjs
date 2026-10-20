import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { photoSharingRequest } from '../workers/photo-auth/photo-sharing.mjs';
import worker from '../workers/photo-auth/worker.mjs';
import publicIndex from '../workers/photo-auth/photo-share-index.mjs';
import { issueToken, random } from '../workers/photo-auth/crypto.mjs';
import { photoShareIndex } from '../scripts/build-photo-share-index.mjs';
import { loadContent, readJson } from '../scripts/journey-content.mjs';
import { readOverrides } from '../scripts/build-site.mjs';

const origin = 'https://atlas.example', service = 'https://photos.example';
const thumbKey = `v1/${'a'.repeat(64)}.webp`, fullKey = `v1/${'b'.repeat(64)}.webp`;
const requestBody = { journeyId: 'trip', photoId: 'photo-one', view: 'photo', scope: 'day' };
function fixture() {
  const reads = [];
  const source = { siteName: 'Atlas', icon: `${origin}/assets/icon.png`, journeys: {
    trip: { page: `${origin}/travels/trip.html`, title: 'My trip', groups: ['walk'], photos: {
      'photo-one': { dayId: 'day-one', title: 'First photograph', thumbnail: { key: thumbKey, width: 480, height: 640 } },
      'photo-two': { dayId: 'day-two', title: 'Second photograph', thumbnail: { key: `v1/${'c'.repeat(64)}.webp`, width: 480, height: 360 } },
      'public-photo': { dayId: 'day-one', title: 'Public example', thumbnail: { url: `${origin}/image.jpg`, width: 480, height: 320 } }
    } }
  } };
  const env = { ALLOWED_ORIGINS: JSON.stringify([origin]), SESSION_SIGNING_KEY: random(), PHOTO_CREDENTIALS: JSON.stringify({ version: 2, credentials: [{ id: 'family', salt: random(), hash: random(), iterations: 600000 }] }),
    PHOTOS: { get: async key => { reads.push(['GET', key]); return { body: new Uint8Array([1, 2, 3]), size: 3, httpMetadata: { contentType: 'image/webp' } }; }, head: async key => { reads.push(['HEAD', key]); return { size: 3, httpMetadata: { contentType: 'image/webp' } }; } } };
  const run = (url, options = {}, allowed = origin) => photoSharingRequest(new Request(new URL(url, service), options), env, allowed, request => request.json(), source);
  const mint = (token, body = requestBody, allowed = origin) => run('/private-photos/share', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }, allowed);
  return { source, env, reads, run, mint, token: async (...args) => (await issueToken(env, 'family', origin, ...args)).token };
}
const imageFrom = html => html.match(/property="og:image" content="([^"]+)"/)[1];

test('share redirects start quiet and reveal a usable fallback only if navigation stalls',async()=>{
  const f=fixture(),{url}=await(await f.mint(await f.token())).json();
  const response=await f.run(url,{},null),html=await response.text();
  assert.match(html,/<main hidden>/);assert.match(html,/<noscript><a href=/);
  const nonce=html.match(/<script nonce="([^"]+)">/)[1];
  assert.ok(response.headers.get('Content-Security-Policy').includes(`style-src 'nonce-${nonce}'`));
  const main={hidden:true},timers=[],redirects=[];
  vm.runInNewContext(html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1],{document:{querySelector:()=>main},setTimeout:(fn,delay)=>timers.push({fn,delay}),location:{replace:href=>redirects.push(href)}});
  assert.equal(main.hidden,true);assert.equal(redirects.length,1);assert.equal(timers[0].delay,1500);
  timers[0].fn();assert.equal(main.hidden,false);
});

test('private photo share capabilities require a valid photo session and allowed origin, without fetching images', async () => {
  const f = fixture(), good = await f.token();
  assert.equal((await f.mint(good, requestBody, null)).status, 403);
  for (const token of ['', `${good}x`, await f.token('access', { now: Math.floor(Date.now() / 1000) - 4000 }), (await issueToken(f.env, 'family', 'https://wrong.example')).token, await f.token('remember')]) {
    assert.equal((await f.mint(token)).status, 401);
  }
  const response = await f.mint(good), { url } = await response.json();
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(url, /^https:\/\/photos\.example\/share\/trip\/photo-one\/[A-Za-z0-9_-]{43}\?view=photo$/);
  assert.equal((await (await f.mint(await f.token())).json()).url, url, 'Stable capability does not depend on visitor/token nonce');
  assert.ok(!url.includes(good)); assert.ok(!url.includes('family')); assert.ok(!url.includes(thumbKey));
  assert.deepEqual(f.reads, []);
});

test('anonymous metadata identifies the exact low-resolution photo and preserves a safe canonical return view', async () => {
  const f = fixture();
  f.source.journeys.trip.photos['photo-one'].title = 'A <quiet> "day" & </script>';
  const { url } = await (await f.mint(await f.token(), { ...requestBody, view: 'story', scope: 'journey', group: 'walk' })).json();
  const response = await f.run(url, {}, null), html = await response.text();
  assert.equal(response.status, 200); assert.match(response.headers.get('Content-Type'), /text\/html/);
  assert.match(html, /og:image:width" content="480"/); assert.match(html, /og:image:height" content="640"/);
  assert.match(html, /og:image:type" content="image\/webp"/);
  assert.match(html, /A &lt;quiet&gt; &quot;day&quot; &amp; &lt;\/script&gt;/);
  const image = imageFrom(html);
  assert.equal(image, `${new URL(url).origin}${new URL(url).pathname}/thumbnail.webp`);
  assert.match(html, /location\.replace\("https:\/\/atlas.example\/travels\/trip.html\?group=walk#day=day-one&photo=photo-one&view=story&scope=journey"\)/);
  assert.ok(!html.includes(fullKey)); assert.ok(!html.includes('/private-photos/assets/'));
  assert.equal(response.headers.get('Location'), null, 'Scrapers receive metadata instead of redirecting to generic branding');
  assert.match(response.headers.get('Content-Security-Policy'), /script-src 'nonce-/);
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
  assert.deepEqual(f.reads, []);
  const head = await f.run(url, { method: 'HEAD' }, null);
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  const imageResponse = await f.run(image, {}, null);
  assert.equal(imageResponse.status, 200); assert.equal(imageResponse.headers.get('Content-Type'), 'image/webp');
  assert.equal(imageResponse.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(new Uint8Array(await imageResponse.arrayBuffer()), new Uint8Array([1, 2, 3]));
  const imageHead = await f.run(image, { method: 'HEAD' }, null);
  assert.equal(imageHead.status, 200); assert.equal(await imageHead.text(), '');
  assert.deepEqual(f.reads, [['GET', thumbKey], ['HEAD', thumbKey]]);
});

test('capabilities cannot be swapped between photos, expanded to full images, or reused after deletion/replacement/key rotation', async () => {
  const f = fixture(), { url } = await (await f.mint(await f.token())).json();
  const base = new URL(url); base.search = '';
  const valid = base.href, image = `${valid}/thumbnail.webp`;
  for (const denied of [valid.replace('photo-one', 'photo-two'), valid.replace('/trip/', '/other/'), `${valid.slice(0, -1)}!`, `${valid}/full.webp`, `${valid}/thumbnail.avif`, `${image}?src=${fullKey}`, `${valid}?photo=photo-two`, `${valid}?url=https://evil.example`, `${valid}?group=unknown`, `${valid}?view=photo&view=map`, `${valid}?view=grid`]) {
    assert.equal((await f.run(denied, {}, null)).status, 404, denied);
  }
  assert.deepEqual(f.reads, []);
  const oldKey = f.env.SESSION_SIGNING_KEY; f.env.SESSION_SIGNING_KEY = random();
  assert.equal((await f.run(image, {}, null)).status, 404); f.env.SESSION_SIGNING_KEY = oldKey;
  const photo = f.source.journeys.trip.photos['photo-one'];
  delete f.source.journeys.trip.photos['photo-one']; assert.equal((await f.run(image, {}, null)).status, 404);
  f.source.journeys.trip.photos['photo-one'] = { ...photo, thumbnail: { ...photo.thumbnail, key: fullKey } };
  assert.equal((await f.run(image, {}, null)).status, 404);
  f.source.journeys.trip.photos['photo-one'] = { ...photo, thumbnail: { ...photo.thumbnail, width: 1280 } };
  assert.equal((await f.run(image, {}, null)).status, 404);
  assert.deepEqual(f.reads, []);
});

test('share minting validates payloads and public sample previews never proxy remote images', async () => {
  const f = fixture(), token = await f.token();
  for (const body of [{ ...requestBody, url: 'https://evil.example' }, { ...requestBody, group: 'unknown' }, { ...requestBody, view: 'grid' }, null, [], { journeyId: 'trip' }]) assert.equal((await f.mint(token, body)).status, 400);
  for (const body of [{ ...requestBody, photoId: 'deleted' }, { ...requestBody, journeyId: '__proto__' }, { ...requestBody, photoId: 'constructor' }]) assert.equal((await f.mint(token, body)).status, 404);
  const response = await f.mint('', { ...requestBody, photoId: 'public-photo' });
  assert.equal(response.status, 200);
  const { url } = await response.json(), html = await (await f.run(url, {}, null)).text();
  assert.equal(imageFrom(html), `${origin}/image.jpg`);
  const base = new URL(url); base.search = '';
  assert.equal((await f.run(`${base.href}/thumbnail.webp`, {}, null)).status, 404);
  assert.equal((await f.run(url, { method: 'POST' }, null)).status, 405);
  assert.equal((await f.run('/private-photos/share')).status, 405);
  assert.deepEqual(f.reads, []);
});

test('missing thumbnails fail closed and malformed private objects cannot be served', async () => {
  const f = fixture(), { url } = await (await f.mint(await f.token())).json(), base = new URL(url); base.search = '';
  const image = `${base.href}/thumbnail.webp`;
  f.env.PHOTOS.get = async () => null;
  assert.equal((await f.run(image, {}, null)).status, 404);
  for (const object of [{ size: 3, httpMetadata: { contentType: 'image/avif' } }, { size: 2 * 1024 * 1024, httpMetadata: { contentType: 'image/webp' } }]) {
    f.env.PHOTOS.get = async () => ({ body: new Uint8Array([1]), ...object });
    await assert.rejects(f.run(image, {}, null), /Invalid thumbnail/);
  }
});

test('Worker routes the new share endpoint and still refuses capability URLs as full-photo authorization', async () => {
  const f = fixture();
  const preflight = await worker.fetch(new Request(`${service}/private-photos/share`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' } }), f.env, {});
  assert.equal(preflight.status, 204);
  const [journeyId, journey] = Object.entries(publicIndex.journeys).find(([, item]) => Object.values(item.photos).some(photo => photo.thumbnail.key));
  const [photoId, photo] = Object.entries(journey.photos).find(([, item]) => item.thumbnail.key);
  const response = await worker.fetch(new Request(`${service}/private-photos/share`, { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${await f.token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ journeyId, photoId }) }), f.env, {});
  assert.equal(response.status, 200); const { url } = await response.json();
  const page = await worker.fetch(new Request(url), f.env, {}); assert.equal(page.status, 200);
  const signature = new URL(url).pathname.split('/').at(-1);
  for (const headers of [{}, { Origin: origin, Authorization: `Bearer ${signature}` }]) {
    const full = await worker.fetch(new Request(`${service}/private-photos/assets/${photo.thumbnail.key}`, { headers }), f.env, {});
    assert.equal(full.status, 401);
  }
  assert.deepEqual(f.reads, []);
});

test('share index follows reference/demo/independent publication, overrides, and low-resolution boundaries', () => {
  const root = path.resolve(import.meta.dirname, '..'), { data } = loadContent(root), overrides = readOverrides(root), site = readJson(path.join(root, 'content/site.json'));
  const photos = Object.fromEntries(data.journeys.map(journey => [journey.id, journey.photos]));
  const draft = { id: 'independent-share-trip', slug: 'independent-share-trip.html', title: 'Independent trip', kind: 'real', published: false, days: [{ id: 'independent-day', title: 'Own event' }, { id: 'moved-day', title: 'Moved event' }], routeGroups: [{ id: 'independent-group' }] };
  photos[draft.id] = [{ id: 'independent-photo', dayId: 'independent-day', caption: '', protected: true, assetStatus: 'published', src: `/private-photos/assets/${fullKey}`, srcset: [{ src: `/private-photos/assets/${thumbKey}`, width: 480, height: 640 }, { src: `/private-photos/assets/${fullKey}`, width: 2400 }], fullAvif: { src: '/private-photos/assets/private-full.avif' }, sourceFilename: 'unpublished-original.heic' }];
  const projection = { journeys: [...data.journeys, draft], photos, overrides, site };
  let index = photoShareIndex(projection);
  assert.ok(index.journeys['switzerland-italy-family-2026']);
  const demo = data.journeys.find(item => item.kind === 'demo' && item.photos.length);
  // The independently supplied demo thumbnail exercises the same projection
  // contract even when an older source fixture has no small derivative yet.
  photos[demo.id] = photos[demo.id].map(photo => ({ ...photo, srcset: [{ src: './assets/photos/sample-thumb.webp', width: 480, height: 320 }] }));
  index = photoShareIndex(projection);
  assert.equal(new URL(index.journeys[demo.id].page).searchParams.get('journey'), demo.id);
  assert.ok(Object.values(index.journeys[demo.id].photos).every(photo => photo.thumbnail.url));
  const sample = photos[demo.id][0]; photos[demo.id] = [{ ...sample, srcset: [], width: 1400, height: 1050 }];
  assert.equal(photoShareIndex(projection).journeys[demo.id], undefined, 'A public full-size sample is not a thumbnail fallback');
  photos[demo.id] = [sample];
  assert.equal(index.journeys[draft.id], undefined, 'A populated unpublished draft cannot mint public shares');
  draft.published = true;
  overrides.photos['independent-photo'] = { dayId: 'moved-day', caption: 'Traveler words' };
  index = photoShareIndex(projection);
  const own = index.journeys[draft.id].photos['independent-photo'];
  assert.equal(own.dayId, 'moved-day'); assert.equal(own.title, 'Traveler words'); assert.equal(own.thumbnail.key, thumbKey);
  const serialized = JSON.stringify(index.journeys[draft.id]);
  assert.ok(!serialized.includes(fullKey)); assert.ok(!serialized.includes('private-full')); assert.ok(!serialized.includes('original.heic'));
  for (const change of [{ assetStatus: 'local' }, { srcset: [{ src: `/private-photos/assets/${fullKey}`, width: 1280 }] }, { mediaType: 'video' }]) {
    const saved = photos[draft.id][0]; photos[draft.id][0] = { ...saved, ...change };
    assert.equal(photoShareIndex(projection).journeys[draft.id], undefined); photos[draft.id][0] = saved;
  }
  overrides.photos['independent-photo'].trashed = true;
  assert.equal(photoShareIndex(projection).journeys[draft.id], undefined);
});
