import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const [action, value, output] = process.argv.slice(2);
const secret = process.env.COMMUNITY_ADMIN_KEY;
if (!['export', 'hide', 'unhide'].includes(action) || (action === 'export' ? !value : !/^[A-Za-z0-9_-]{43}$/.test(value || '')) || output) throw new Error('Usage: COMMUNITY_ADMIN_KEY=… node scripts/community-admin.mjs export <private-output.json> | hide <comment-id> | unhide <comment-id>');
if (!secret || secret.length < 43) throw new Error('Provide the separate COMMUNITY_ADMIN_KEY through the environment. Never use a photo password.');
const { origin } = JSON.parse(fs.readFileSync(path.join(root, 'content/photo-service.json'), 'utf8'));
async function request(endpoint, options = {}) {
  const response = await fetch(origin + '/community/admin/' + endpoint, { ...options, headers: { Authorization: `Bearer ${secret}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Community operation failed (${response.status}).`);
  return result;
}
if (action === 'export') {
  const rows = []; let after = '';
  do { const page = await request(`export${after ? '?after=' + encodeURIComponent(after) : ''}`); rows.push(...page.comments); after = page.next; } while (after);
  fs.writeFileSync(value, JSON.stringify({ exportedAt: new Date().toISOString(), comments: rows }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log(`Exported ${rows.length} comments. Keep this file private; it includes removed content and ownership IDs.`);
} else {
  await request(`comments/${value}`, { method: 'PATCH', body: JSON.stringify({ hidden: action === 'hide' }) });
  console.log(action === 'hide' ? 'Comment hidden from visitors.' : 'Comment restored to visitor visibility (unless its author deleted it).');
}
