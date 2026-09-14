import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const studioWorkspaceId = root => crypto.createHash('sha256').update(path.resolve(root)).digest('hex').slice(0, 20);
const directory = root => path.join(root, 'build/studio-drafts');
function filename(root, id) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('Invalid draft ID');
  return path.join(directory(root), `${id}.json`);
}
export function readStudioDraft(root, id) {
  const file = filename(root, id);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}
export function writeStudioDraft(root, id, draft) {
  const file = filename(root, id);
  if (draft?.schema !== 1 || !Number.isSafeInteger(draft.sequence) || draft.sequence < 1 || typeof draft.dirty !== 'boolean' || !draft.state || !Array.isArray(draft.plans)) throw new Error('Invalid draft snapshot');
  const previous = readStudioDraft(root, id);
  if (previous && previous.sequence >= draft.sequence) return previous;
  // Incomplete forms are intentional here. Only explicit Save validates and
  // writes content sources; automatic drafts can never enter a public build.
  fs.mkdirSync(directory(root), { recursive:true });
  if (draft.discarded && !previous?.discarded) {
    const archiveId=`discarded-${id}-${draft.sequence}`;
    const archived={...draft,dirty:true,discarded:false,id:archiveId,updatedAt:new Date().toISOString(),title:`Discarded draft: ${draft.title || 'Journey edits'}`};
    fs.writeFileSync(filename(root,archiveId),`${JSON.stringify(archived)}\n`,{mode:0o600});
  }
  const saved = { ...draft, id, updatedAt: new Date().toISOString() };
  fs.mkdirSync(directory(root), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(saved)}\n`, {mode:0o600});
  fs.renameSync(`${file}.tmp`, file);
  return saved;
}
export function listStudioDrafts(root) {
  if (!fs.existsSync(directory(root))) return [];
  return fs.readdirSync(directory(root)).filter(name => /^[a-zA-Z0-9-]+\.json$/.test(name)).flatMap(name => {
    try {
      const draft = readStudioDraft(root, name.slice(0, -5));
      return draft?.dirty ? [{id:draft.id, updatedAt:draft.updatedAt, title:draft.title || 'Journey edits'}] : [];
    } catch { return []; }
  }).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
}
