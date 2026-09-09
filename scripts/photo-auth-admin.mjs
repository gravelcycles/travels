#!/usr/bin/env node
// Local-only credential editor. Passwords are never saved, logged, or returned.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCredential, random } from '../workers/photo-auth/crypto.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'build/private-auth/secrets.json');
fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
const capability = process.env.ATLAS_AUTH_ADMIN_KEY || random();
if (!/^[A-Za-z0-9_-]{43}$/.test(capability)) throw new Error('Invalid local setup key');
const port = Number(process.env.ATLAS_AUTH_ADMIN_PORT || 4175);
const origin = `http://127.0.0.1:${port}`;
const load = () => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { PHOTO_CREDENTIALS: JSON.stringify({ version: 2, credentials: [] }), SESSION_SIGNING_KEY: random() };
const save = value => { fs.writeFileSync(`${file}.tmp`, JSON.stringify(value), { mode: 0o600 }); fs.renameSync(`${file}.tmp`, file); };
let busy = false;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, origin);
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  if (req.headers.host !== `127.0.0.1:${port}` || url.searchParams.get('key') !== capability) { res.writeHead(403); res.end('Not allowed'); return; }
  if (req.method === 'GET' && url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Set photo passwords</title><style>body{font:17px system-ui;background:#f5f1e7;color:#273f40;max-width:540px;margin:50px auto;padding:24px}h1{font:38px Georgia}label{display:block;margin-top:20px}input,button{font:inherit;box-sizing:border-box;padding:12px;width:100%;margin-top:6px;border-radius:7px;border:1px solid #68857f}button{background:#235c56;color:white;cursor:pointer}li{margin:8px 0}small,p{line-height:1.6}#message{min-height:2em}</style><h1>Set photo passwords</h1><p>Add a password for family, friends, or another group. Every active password unlocks all trip photos. These are separate from your Cloudflare account password.</p><form><label for="label">Password label</label><input id="label" placeholder="family" pattern="[a-z0-9-]{1,64}" required><label for="password">Shared photo password</label><input id="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required><label for="confirm">Repeat password</label><input id="confirm" type="password" autocomplete="new-password" required><button>Add password</button></form><p id="message" role="status"></p><h2>Active passwords</h2><ul id="list"></ul><p>Keep your chosen passwords in your password manager. Only salted password verifiers are saved here. When finished, return to Codex and say “passwords ready”.</p><script>const query=location.search,list=document.querySelector('#list'),message=document.querySelector('#message'),form=document.querySelector('form');async function refresh(){const r=await fetch('/credentials'+query);const data=await r.json();list.replaceChildren();for(const id of data.ids){const li=document.createElement('li');li.textContent=id;list.append(li);}}form.onsubmit=async e=>{e.preventDefault();const password=document.querySelector('#password'),confirm=document.querySelector('#confirm'),label=document.querySelector('#label');if(password.value!==confirm.value){message.textContent='The passwords do not match.';return;}form.querySelector('button').disabled=true;message.textContent='Saving…';try{const r=await fetch('/credentials'+query,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:label.value,password:password.value})});const data=await r.json();if(!r.ok)throw new Error(data.error);password.value='';confirm.value='';label.value='';message.textContent='Password added. You can add another or return to Codex.';await refresh();}catch(e){message.textContent=e.message;}finally{form.querySelector('button').disabled=false;}};refresh();</script></html>`); return;
  }
  if (url.pathname !== '/credentials') { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type','application/json');
  if (req.method === 'GET') { res.end(JSON.stringify({ ids: JSON.parse(load().PHOTO_CREDENTIALS).credentials.map(c => c.id) })); return; }
  if (req.method !== 'POST' || req.headers.origin !== origin || req.headers['content-type'] !== 'application/json' || busy) { res.writeHead(403); res.end('{}'); return; }
  busy = true;
  try {
    let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 2048) throw new Error('Request too large'); }
    const { id, password } = JSON.parse(body); const secrets = load(), config = JSON.parse(secrets.PHOTO_CREDENTIALS);
    if (config.credentials.some(c => c.id === id)) throw new Error('That label already exists. Choose a new label.');
    if (config.retiredIds?.includes(id)) throw new Error('That label was revoked. Choose a new label to keep old sessions revoked.');
    if (config.credentials.length >= 8) throw new Error('Eight active passwords are supported.');
    config.credentials.push(await createCredential(id, password));
    secrets.PHOTO_CREDENTIALS = JSON.stringify(config); save(secrets);
    res.end(JSON.stringify({ ok: true }));
  } catch (error) { res.writeHead(400); res.end(JSON.stringify({ error: error.message })); }
  finally { busy = false; }
});
server.listen(port,'127.0.0.1',()=>console.log(`Private password setup: ${origin}/?key=${capability}`));
