#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {loadJourneys,readJson,writeJson} from './journey-content.mjs';
import {existingPhotoVariants,isPrivatePhotoUrl,privatePhotoFile,storeDerivative} from './photo-variants.mjs';
export function migratePrivatePhotos(root,{apply=false}={}){
  const changes=[];let photos=0,objects=0,bytes=0;
  for(const journey of loadJourneys(root,{includeDrafts:true}).journeys.filter(j=>j.kind==='real'))for(const suffix of ['', '-uploads']){
    const file=path.join(root,journey.published?`content/photo-manifests/${journey.id}${suffix}.json`:`build/draft-assets/${journey.id}/${suffix?'uploads':'photos'}.json`);
    if(!fs.existsSync(file))continue;
    const updated=readJson(file).map(photo=>{
      const selected=existingPhotoVariants(photo);photos++;
      const variants=selected.map(v=>{
        let source;
        if(isPrivatePhotoUrl(v.src))source=privatePhotoFile(root,v.src);
        else {const match=v.src.match(/^https:\/\/github\.com\/gravelcycles\/travels\/releases\/download\/([a-z0-9-]+)\/([a-z0-9-]+\.webp)$/);if(!match)throw new Error('Unexpected legacy photo path');source=path.join(root,'build',match[1],match[2]);}
        const data=fs.readFileSync(source);objects++;bytes+=data.length;
        const src=apply?storeDerivative(root,data):v.src;return {...v,src};
      });
      return {...photo,src:variants.at(-1).src,srcset:variants,protected:true};
    });changes.push({file,updated});
  }
  if(apply){const backup=path.join(root,`build/backups/private-photo-migration-${Date.now()}`);fs.mkdirSync(backup,{recursive:true});for(const {file,updated} of changes){fs.copyFileSync(file,path.join(backup,path.basename(file)));writeJson(file,updated);}}
  return {photos,objects,bytes,applied:apply};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(migratePrivatePhotos(path.resolve(import.meta.dirname,'..'),{apply:process.argv.includes('--apply')}));
