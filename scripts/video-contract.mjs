export const VIDEO_PREFIX = '/private-videos/assets/';
export const MAX_VIDEO_BYTES = 250 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 300;
export const isPrivateVideoUrl = value => /^\/private-videos\/assets\/v1\/[a-f0-9]{64}\.mp4$/.test(value || '');
