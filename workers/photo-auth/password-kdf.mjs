// Runs only in the owner's local setup process or the visitor's browser.
// This function is also embedded verbatim in the nonce-protected login page:
// keep it self-contained and never accept a server-supplied lower work factor.
export async function derivePasswordProofs(password, parameters) {
  if (typeof password !== 'string' || !password.length || new TextEncoder().encode(password).length > 512) throw new Error('Enter a photo password.');
  if (!Array.isArray(parameters) || !parameters.length || parameters.length > 8) throw new Error('Invalid photo login settings.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const proofs = [];
  for (const item of parameters) {
    if (!/^[a-z0-9-]{1,64}$/.test(item.id) || !/^[A-Za-z0-9_-]{43}$/.test(item.salt) || item.iterations !== 600000) throw new Error('Invalid photo login settings.');
    const decoded = atob(item.salt.replaceAll('-', '+').replaceAll('_', '/') + '=');
    if (decoded.length !== 32) throw new Error('Invalid photo login settings.');
    const salt = new Uint8Array(32);
    for (let i = 0; i < salt.length; i++) salt[i] = decoded.charCodeAt(i);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 }, key, 256));
    let encoded = '';
    for (const byte of bits) encoded += String.fromCharCode(byte);
    proofs.push({ id: item.id, proof: btoa(encoded).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '') });
    bits.fill(0);
  }
  return proofs;
}
