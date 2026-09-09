import { WorkerEntrypoint } from 'cloudflare:workers';
import { cachedPhoto } from './photo-cache.mjs';
export { default } from './worker.mjs';
export { PhotoAuthCode } from './codes.mjs';
export class PhotoCache extends WorkerEntrypoint {
  fetch(request) { return cachedPhoto(request, this.env); }
}
