#!/usr/bin/env node
// Agent-operated maintenance. Prints credential labels only; never secret values.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { random } from '../workers/photo-auth/crypto.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'build/private-auth/secrets.json');
try {
  if(!fs.existsSync(file))throw new Error('Use the local password setup page first.');
  const secrets=JSON.parse(fs.readFileSync(file,'utf8')),config=JSON.parse(secrets.PHOTO_CREDENTIALS);
  const [command,id]=process.argv.slice(2);
  if(command==='list')console.log(config.credentials.map(c=>c.id).join('\n')||'No active passwords.');
  else if(command==='revoke'||command==='rotate-sessions'){
    if(command==='revoke'){
      if(!config.credentials.some(c=>c.id===id))throw new Error('Unknown credential label.');
      config.credentials=config.credentials.filter(c=>c.id!==id);
      config.retiredIds=[...new Set([...(config.retiredIds||[]),id])];
      secrets.PHOTO_CREDENTIALS=JSON.stringify(config);
    }else secrets.SESSION_SIGNING_KEY=random();
    fs.writeFileSync(`${file}.tmp`,JSON.stringify(secrets),{mode:0o600});fs.renameSync(`${file}.tmp`,file);
    console.log('Saved locally. Deploy secrets to apply the change.');
  }else if(command==='deploy'){
    const result=spawnSync(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'secret','bulk',file,'--config',path.join(root,'workers/photo-auth/wrangler.jsonc')],{cwd:root,stdio:'inherit'});
    if(result.error||result.status!==0)throw new Error('Secret deployment did not complete.');
    const activation=spawnSync(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'deploy','--config',path.join(root,'workers/photo-auth/wrangler.jsonc')],{cwd:root,stdio:'inherit'});
    if(activation.error||activation.status!==0)throw new Error('Secrets saved, but Worker activation did not complete.');
  }else throw new Error('Use list, revoke <label>, rotate-sessions, or deploy. Add passwords through npm run auth:manage.');
}catch(error){console.error(error.message);process.exitCode=1;}
