import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Keep the photo source layout intact: metadata may live inline, in a reviewed
// manifest, or in the upload manifest. Only group assignments are editable here.
export function writePlanSources(root, base, journey) {
  const sourcePath = path.join(root, `content/${base.published ? 'journeys' : 'drafts'}/${base.id}.json`);
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const byId = new Map(journey.photos.map(photo => [photo.id, photo]));
  const groupsOnly = photos => photos.map(photo => {
    const next = byId.get(photo.id); if (!next) return photo;
    const result = {...photo};
    if (next.groupIds?.length) result.groupIds = next.groupIds; else delete result.groupIds;
    return result;
  });
  const writes = new Map([[sourcePath, {...journey,photos:groupsOnly(source.photos)}]]);
  for (const relative of base.published ? [`content/photo-manifests/${base.id}.json`,`content/photo-manifests/${base.id}-uploads.json`] : [`build/draft-assets/${base.id}/photos.json`,`build/draft-assets/${base.id}/uploads.json`]) {
    const filename = path.join(root, relative);
    if (!fs.existsSync(filename)) continue;
    const photos = JSON.parse(fs.readFileSync(filename,'utf8')), updated = groupsOnly(photos);
    if (JSON.stringify(photos) !== JSON.stringify(updated)) writes.set(filename,updated);
  }
  const originals = new Map([...writes.keys()].map(filename => [filename,fs.readFileSync(filename,'utf8')]));
  const restore = () => { for (const [filename,contents] of originals) fs.writeFileSync(filename,contents); };
  const backupDir = path.join(root,'build/studio-backups'), stamp = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  fs.mkdirSync(backupDir,{recursive:true});
  try {
    let index = 0;
    for (const [filename,value] of writes) {
      fs.writeFileSync(path.join(backupDir,`${stamp}-${base.id}-${index++}-${path.basename(filename)}`), originals.get(filename));
      const temporary = `${filename}.tmp`;
      fs.writeFileSync(temporary,JSON.stringify(value,null,2)+'\n'); fs.renameSync(temporary,filename);
    }
  } catch (error) { restore(); throw error; }
  return {restore};
}
