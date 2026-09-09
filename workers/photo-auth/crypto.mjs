import { derivePasswordProofs } from './password-kdf.mjs';
const encoder = new TextEncoder();
export const ACCESS_SECONDS = 3600;
export const REMEMBER_SECONDS = 30 * 24 * 3600;
export const ITERATIONS = 600000;
export function base64url(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
export function unbase64url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid encoding');
  const encoded = value.replaceAll('-', '+').replaceAll('_', '/');
  const bytes = Uint8Array.from(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')), c => c.charCodeAt(0));
  if (base64url(bytes) !== value) throw new Error('Noncanonical encoding');
  return bytes;
}
export const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
// The stored verifier is a separate one-way hash, never the proof accepted at login.
export async function hashPasswordProof(proof, credential) {
  const prefix = encoder.encode(`atlas-photo-verifier-v2:${credential.id}:`);
  const salt = unbase64url(credential.salt), input = unbase64url(proof);
  if (salt.length !== 32 || input.length !== 32) throw new Error('Invalid proof');
  const message = new Uint8Array(prefix.length + salt.length + input.length);
  message.set(prefix); message.set(salt, prefix.length); message.set(input, prefix.length + salt.length);
  return base64url(await crypto.subtle.digest('SHA-256', message));
}
export async function createCredential(id, password) {
  if (!/^[a-z0-9-]{1,64}$/.test(id) || typeof password !== 'string' || password.length < 12 || encoder.encode(password).length > 512) throw new Error('Use a named credential and a password of at least 12 characters (maximum 512 bytes).');
  const credential = { id, salt: random(), iterations: ITERATIONS };
  const [derived] = await derivePasswordProofs(password, [credential]);
  return { ...credential, hash: await hashPasswordProof(derived.proof, credential) };
}
export function credentials(env) {
  const config = JSON.parse(env.PHOTO_CREDENTIALS);
  if (config.version !== 2 || !Array.isArray(config.credentials) || !config.credentials.length || config.credentials.length > 8) throw new Error('Invalid credential configuration');
  const ids = new Set();
  for (const c of config.credentials) {
    if (!/^[a-z0-9-]{1,64}$/.test(c.id) || ids.has(c.id) || c.iterations !== ITERATIONS || unbase64url(c.salt).length !== 32 || unbase64url(c.hash).length !== 32) throw new Error('Invalid credential configuration');
    ids.add(c.id);
  }
  return config.credentials;
}
async function signingKey(env) {
  const bytes = unbase64url(env.SESSION_SIGNING_KEY);
  if (bytes.length !== 32) throw new Error('Invalid signing configuration');
  return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function verifyPasswordProofs(proofs, active) {
  if (!Array.isArray(proofs) || proofs.length !== active.length) return null;
  const supplied = new Map();
  for (const item of proofs) {
    if (!item || typeof item.id !== 'string' || supplied.has(item.id) || !active.some(c => c.id === item.id) || !/^[A-Za-z0-9_-]{43}$/.test(item.proof || '')) return null;
    supplied.set(item.id, item.proof);
  }
  let accepted = null;
  for (const credential of active) {
    let candidate;
    try { candidate = await hashPasswordProof(supplied.get(credential.id), credential); } catch { return null; }
    const key = await crypto.subtle.importKey('raw', unbase64url(credential.hash), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const candidateKey = await crypto.subtle.importKey('raw', unbase64url(candidate), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const proof = await crypto.subtle.sign('HMAC', key, encoder.encode('travel-photo-password-verification-v2'));
    if (await crypto.subtle.verify('HMAC', candidateKey, proof, encoder.encode('travel-photo-password-verification-v2'))) accepted = credential;
  }
  return accepted;
}
export async function issueToken(env, id, audience, kind = 'access', { now = Math.floor(Date.now() / 1000), expires } = {}) {
  const life = kind === 'remember' ? REMEMBER_SECONDS : ACCESS_SECONDS;
  const payload = { v: 1, id, aud: audience, kind, iat: now, exp: Math.min(now + life, expires ?? now + life), nonce: random() };
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  return { token: `${body}.${base64url(await crypto.subtle.sign('HMAC', await signingKey(env), encoder.encode(body)))}`, expiresAt: payload.exp };
}
export async function validateToken(token, env, audience, kind = 'access', now = Math.floor(Date.now() / 1000)) {
  const active = credentials(env);
  const key = await signingKey(env); // Broken configuration is a service error, not anonymous fallback.
  try {
    if (typeof token !== 'string' || token.length > 2048) return null;
    const parts = token.split('.');
    if (parts.length !== 2 || unbase64url(parts[1]).length !== 32 || !await crypto.subtle.verify('HMAC', key, unbase64url(parts[1]), encoder.encode(parts[0]))) return null;
    const p = JSON.parse(new TextDecoder().decode(unbase64url(parts[0])));
    const life = kind === 'remember' ? REMEMBER_SECONDS : ACCESS_SECONDS;
    if (p.v !== 1 || p.aud !== audience || p.kind !== kind || !Number.isInteger(p.iat) || !Number.isInteger(p.exp) || p.iat > now + 30 || p.exp <= now || p.exp <= p.iat || p.exp - p.iat > life || unbase64url(p.nonce).length !== 32 || !active.some(c => c.id === p.id)) return null;
    return p;
  } catch { return null; }
}
