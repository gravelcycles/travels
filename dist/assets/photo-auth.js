(function () {
  'use strict';
  const config = window.JOURNEY_ATLAS_PHOTO_SERVICE || {};
  const local = ['127.0.0.1', 'localhost'].includes(location.hostname) && new URLSearchParams(location.search).get('photoSource') === 'local';
  const protectedPath = /^\/private-photos\/assets\/v1\/[a-f0-9]{64}\.webp$/;
  let service = '';
  try { const url = new URL(config.origin); if (url.origin === config.origin && (url.protocol === 'https:' || (['127.0.0.1','localhost'].includes(location.hostname) && ['127.0.0.1','localhost'].includes(url.hostname)))) service = url.origin; } catch { /* Unconfigured always stays locked. */ }
  let token = '', expiresAt = 0, generation = 0, expiryTimer, lastFocus;
  const ACCESS_KEY='atlas-photo-access';
  const images = new Map(), cache = new Map();
  const MAX_CACHE = 96, MAX_CACHE_BYTES = 64 * 1024 * 1024;
  const STATUS_INTERVAL = 60000;
  const REQUEST_TIMEOUT = 10000, MAX_DOWNLOADS = 4, MAX_BACKGROUND = 2;
  const downloadQueue = [], activeDownloads = new Set();
  let lastCheck = 0, checkPending = null;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="24"%3E%3Cpath fill="%23d4ded8" d="M0 0h32v24H0z"/%3E%3C/svg%3E';
  const isProtected = photo => Boolean(photo?.protected || protectedPath.test(photo?.src || ''));
  const selected = (photo, width=1280) => { const variants=[...(photo.srcset || [])].sort((a,b)=>a.width-b.width);return (variants.find(v=>v.width>=width)||variants.at(-1))?.src||photo.src; };
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('atlas-photo-lock') : null;
  const dialog = document.createElement('dialog'); dialog.className='photo-unlock-dialog';dialog.setAttribute('aria-labelledby','photo-unlock-title');
  dialog.innerHTML='<h2 id="photo-unlock-title">Private photographs</h2><p>The journey is here to explore. Unlock the photos with a shared password.</p><button type="button" data-unlock>Unlock photos</button><p class="photo-unlock-hint">You’ll visit a secure login page, then return here. Access is remembered for 30 days.</p><p data-auth-message role="status" aria-live="polite"></p><button type="button" class="photo-auth-secondary" data-dismiss>Continue without photos</button>';
  document.body.append(dialog);
  const status = document.createElement('span');status.className='photo-auth-controls';
  status.innerHTML='<button type="button" data-unlock>View photos</button>';
  (document.querySelector('.header-context')||document.querySelector('.site-header')||document.body).append(status);
  const message = dialog.querySelector('[data-auth-message]');
  function updateControls() {
    status.querySelector('[data-unlock]').hidden=Boolean(token)||local;
  }
  function release(img) {
    const previous=images.get(img);if(previous?.entry)previous.entry.refs.delete(img);images.delete(img);
    for(const src of [previous?.src,previous?.preview]) {
      const entry=cache.get(src);
      if(entry&&!entry.url&&![...images.values()].some(item=>item.src===src||item.preview===src)) {
        cache.delete(src);entry.controller.abort();
      }
    }
  }
  function clearImage(img) {
    release(img);observer?.unobserve(img);delete img.dataset.privateSrc;delete img.dataset.privateBlur;
  }
  function prune() {
    for(const [img] of images)if(!img.isConnected)release(img);
    // A loading image has not attached its blob yet, but already needs its request.
    const loading=new Set([...images.values()].filter(item=>item.loading).flatMap(item=>[item.src,item.preview]));
    const unused=[...cache].filter(([key,entry])=>!entry.refs.size&&!loading.has(key));
    let bytes=unused.reduce((total,[,entry])=>total+(entry.bytes||0),0), count=unused.length;
    for(const [key,entry] of unused) {
      if(count<=MAX_CACHE&&bytes<=MAX_CACHE_BYTES)break;
      bytes-=entry.bytes||0;count--;
      entry.controller.abort();if(entry.url)URL.revokeObjectURL(entry.url);cache.delete(key);
    }
  }
  function lock(broadcast=true) {
    token='';expiresAt=0;generation++;lastCheck=0;checkPending=null;clearTimeout(expiryTimer);
    try{sessionStorage.removeItem(ACCESS_KEY);}catch{}
    for(const [img,item] of images){img.removeAttribute('srcset');img.src=item.blur;img.classList.remove('is-loaded');item.entry=null;item.loading=false;imageState(img,'locked');}
    for(const entry of cache.values()){entry.controller.abort();if(entry.url)URL.revokeObjectURL(entry.url);}
    cache.clear();updateControls();if(broadcast)channel?.postMessage('lock');
    window.dispatchEvent(new Event('atlas-photos-locked'));
  }
  function showPrompt(text='') { updateControls();message.textContent=text;lastFocus=document.activeElement;if(!dialog.open)dialog.showModal(); }
  function closePrompt(){dialog.close();lastFocus?.focus?.();}
  function pumpDownloads() {
    downloadQueue.sort((a,b)=>a.priority-b.priority);
    while(activeDownloads.size<MAX_DOWNLOADS&&downloadQueue.length) {
      const next=downloadQueue[0];
      if(next.priority>0&&[...activeDownloads].filter(entry=>entry.priority>0).length>=MAX_BACKGROUND)break;
      downloadQueue.shift();activeDownloads.add(next);next.run();
    }
  }
  async function download(src,entry,epoch) {
    for(let attempt=0;attempt<2;attempt++) {
      if(entry.controller.signal.aborted||epoch!==generation)throw new Error('Photo request cancelled');
      const controller=new AbortController(),abort=()=>controller.abort();
      entry.controller.signal.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(abort,REQUEST_TIMEOUT);
      try {
        const started=Date.now();
        const response=await fetch(local?`/build/private-photo-assets/${src.slice('/private-photos/assets/'.length)}`:`${service}${src}`,{credentials:'omit',headers:local?{}:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal,priority:entry.priority<2?'high':'low'});
        if(response.status===401){if(epoch===generation)lock();throw new Error('Photos locked');}
        if(!response.ok){const error=new Error('Photo could not load');error.photoFailure=`HTTP ${response.status}`;error.permanent=response.status<500&&![408,429].includes(response.status);throw error;}
        if(response.headers.get('Content-Type')?.split(';')[0]!=='image/webp'){const error=new Error('Invalid photo response');error.permanent=true;throw error;}
        const blob=await response.blob();
        if(epoch!==generation||entry.controller.signal.aborted||controller.signal.aborted)throw new Error('Photo request cancelled');
        entry.bytes=blob.size;entry.downloadMs=Date.now()-started;entry.edgeCache=response.headers.get('X-Photo-Cache')||'UNKNOWN';entry.serverTiming=response.headers.get('Server-Timing')||'';entry.url=URL.createObjectURL(blob);return entry;
      } catch(error) {
        if(controller.signal.aborted&&!entry.controller.signal.aborted)error.photoFailure='timeout';
        if(attempt===1||error.permanent||epoch!==generation||entry.controller.signal.aborted)throw error;
      } finally {clearTimeout(timer);entry.controller.signal.removeEventListener('abort',abort);}
    }
  }
  async function fetchPhoto(src,priority=1) {
    if(!protectedPath.test(src))throw new Error('Invalid photo');
    if(!local&&(!token||expiresAt<=Date.now()/1000)){if(token)lock();throw new Error('Photos locked');}
    let entry=cache.get(src);
    if(entry){cache.delete(src);cache.set(src,entry);entry.priority=Math.min(entry.priority,priority);pumpDownloads();return entry.promise;}
    const epoch=generation,controller=new AbortController();entry={controller,priority,refs:new Set(),url:null,promise:null,bytes:0};
    entry.promise=new Promise((resolve,reject)=>{
      const onAbort=()=>{const index=downloadQueue.indexOf(entry);if(index>=0){downloadQueue.splice(index,1);reject(new Error('Photo request cancelled'));}};
      controller.signal.addEventListener('abort',onAbort,{once:true});
      entry.run=()=>download(src,entry,epoch).then(resolve,reject).finally(()=>{controller.signal.removeEventListener('abort',onAbort);activeDownloads.delete(entry);pumpDownloads();});
    }).catch(error=>{if(cache.get(src)===entry)cache.delete(src);throw error;});
    cache.set(src,entry);downloadQueue.push(entry);pumpDownloads();prune();return entry.promise;
  }
  function imageState(img,state) {
    img.dataset.photoState=state;img.dispatchEvent(new Event('atlas-photo-state'));
  }
  function display(img,item,entry) {
    item.entry?.refs.delete(img);item.entry=entry;entry.refs.add(img);
    img.dataset.photoCache=entry.edgeCache;img.dataset.photoDownloadMs=String(entry.downloadMs);img.dataset.photoServerTiming=entry.serverTiming;
    img.addEventListener('load',()=>{if(images.get(img)===item){img.classList.add('is-loaded');imageState(img,'ready');}},{once:true});
    img.src=entry.url;img.classList.add('is-loaded');delete img.dataset.photoError;delete img.dataset.photoFailure;imageState(img,'ready');
  }
  async function hydrate(img) {
    const src=img.dataset.privateSrc;if(!src||(!local&&!token))return;
    let item=images.get(img);
    if(!item||item.src!==src){release(img);item={src,blur:img.dataset.privateBlur||placeholder,entry:null,priority:1};images.set(img,item);}
    if(item.loading||(item.entry&&item.entry===cache.get(src)))return;
    item.loading=true;const epoch=generation;
    const current=()=>epoch===generation&&images.get(img)===item&&img.isConnected;
    if(!item.entry)imageState(img,'loading');
    try {
      if(item.preview&&item.preview!==src&&!item.entry&&!cache.get(src)?.url) {
        try {const preview=await fetchPhoto(item.preview,0);if(!current())return;display(img,item,preview);}
        catch(error){if(!current()||(!local&&!token))return;}
      }
      const entry=await fetchPhoto(src,item.priority??1);
      if(!current())return;display(img,item,entry);
    } catch(error) {
      if(current()&&(local||token)&&!item.entry){img.dataset.photoError='true';img.dataset.photoFailure=error.photoFailure||'network';imageState(img,'error');img.dispatchEvent(new Event('error'));}
    } finally {item.loading=false;prune();}
  }
  function setImage(img,photo,width=1280) {
    const src=selected(photo,width),preview=selected(photo,1280),thumbnail=selected(photo,480);
    if(token&&expiresAt<=Date.now()/1000)lock();
    const previous=images.get(img);
    if(previous?.src===src&&previous.loading){for(const key of [src,preview]){const pending=cache.get(key);if(pending)pending.priority=0;}if(previous.entry)img.classList.add('is-loaded');imageState(img,previous.entry?'ready':'loading');pumpDownloads();return;}
    const ready=(local||token)?[src,preview,thumbnail].map(key=>cache.get(key)).find(entry=>entry?.url):null;
    if(ready&&images.get(img)?.entry===ready&&images.get(img)?.src===src&&img.src===ready.url){img.classList.add('is-loaded');imageState(img,'ready');hydrate(img);return;}
    release(img);img.removeAttribute('srcset');delete img.dataset.src;delete img.dataset.srcset;delete img.dataset.photoError;
    img.dataset.privateSrc=src;img.dataset.privateBlur=photo.blur||placeholder;
    const item={src,preview,blur:img.dataset.privateBlur,entry:null,priority:0};images.set(img,item);
    if(ready){display(img,item,ready);prune();}
    else {img.src=photo.blur||placeholder;img.classList.remove('is-loaded');imageState(img,(local||token)?'loading':'locked');}
    hydrate(img);
  }
  const observer='IntersectionObserver'in window?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){hydrate(entry.target);observer.unobserve(entry.target);}},{rootMargin:'250px'}):null;
  function prepare(container=document) {
    for(const img of container.querySelectorAll('img[data-private-src]')){
      if(!images.has(img))images.set(img,{src:img.dataset.privateSrc,blur:img.dataset.privateBlur||placeholder,entry:null});
      if(img.dataset.eager==='true'||!observer)hydrate(img);else observer.observe(img);
    }prune();
  }
  function markup(photo,options={}) {
    const src=selected(photo,options.targetWidth||1280),blur=photo.blur||placeholder;
    return `<img class="progressive-image" src="${escape(blur)}" data-private-src="${escape(src)}" data-private-blur="${escape(blur)}" alt="${escape(options.alt??photo.alt??'')}"${photo.width?` width="${photo.width}" height="${photo.height}"`:''} loading="${options.eager?'eager':'lazy'}" decoding="async"${options.eager?' data-eager="true"':''} />`;
  }
  const FLOW_KEY='atlas-photo-login';
  const randomState=()=>btoa(Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  async function begin(action='login') {
    if(!service){showPrompt('Photo access is being prepared. Please return soon.');return;}
    if(action==='logout')lock();
    const state=randomState(),verifier=randomState();
    const challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    const returnTo=location.origin+location.pathname+location.search;
    try{sessionStorage.setItem(FLOW_KEY,JSON.stringify({state,verifier,hash:location.hash,created:Date.now()}));}
    catch{showPrompt('Allow session storage for this site to complete the secure login.');return;}
    location.assign(`${service}/private-photos/auth/window?${new URLSearchParams({origin:location.origin,state,challenge,returnTo,action})}`);
  }
  async function completeReturn() {
    const params=new URLSearchParams(location.hash.slice(1));
    if(!params.has('photoAuthCode')&&!params.has('photoAuthLogout')&&!params.has('photoAuthCancel')&&!params.has('photoAuthMissing')){if(!await restoreTabAccess())await begin('restore');return;}
    let flow;try{flow=JSON.parse(sessionStorage.getItem(FLOW_KEY));sessionStorage.removeItem(FLOW_KEY);}catch{}
    // Remove the short-lived one-use code before loading anything else from this page.
    history.replaceState(null,'',location.pathname+location.search+(flow?.hash||''));
    if(!flow||params.get('state')!==flow.state||Date.now()-flow.created>300000){showPrompt('Login expired. Please unlock again.');return;}
    if(params.has('photoAuthMissing')){showPrompt();return;}
    if(params.has('photoAuthLogout')||params.has('photoAuthCancel')){lock();if(dialog.open)closePrompt();return;}
    const epoch=generation;
    try{
      const response=await fetch(`${service}/private-photos/auth/redeem`,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:params.get('photoAuthCode'),verifier:flow.verifier})});
      const data=await response.json();
      if(epoch!==generation)return;
      if(!response.ok||!validAccess(data))throw new Error('Login expired. Please unlock again.');
      acceptAccess(data);
    }catch{showPrompt('Could not restore photo access. Please unlock again.');}
  }
  function validAccess(data){return typeof data?.token==='string'&&data.token.length<=2048&&Number.isInteger(data.expiresAt)&&data.expiresAt>Date.now()/1000&&data.expiresAt<=Date.now()/1000+3630;}
  function acceptAccess(data){
    lock(false);token=data.token;expiresAt=data.expiresAt;lastCheck=Date.now();
    // Only the one-hour access token is tab-scoped; the 30-day cookie stays HttpOnly.
    try{sessionStorage.setItem(ACCESS_KEY,JSON.stringify({token,expiresAt}));}catch{}
    expiryTimer=setTimeout(()=>lock(),Math.max(0,expiresAt*1000-Date.now()));
    updateControls();if(dialog.open)closePrompt();for(const [img,item] of images)if(img.isConnected&&item.priority===0)hydrate(img);prepare();window.dispatchEvent(new Event('atlas-photos-unlocked'));
  }
  async function restoreTabAccess(){
    let saved;try{saved=JSON.parse(sessionStorage.getItem(ACCESS_KEY));}catch{}
    if(!validAccess(saved))return false;
    const epoch=generation;
    try{
      const response=await fetch(`${service}/private-photos/auth/status`,{headers:{Authorization:`Bearer ${saved.token}`},credentials:'omit',cache:'no-store'});
      const data=await response.json();
      if(epoch!==generation)return true;
      if(!response.ok||data.unlocked!==true||data.expiresAt!==saved.expiresAt)return false;
      acceptAccess(saved);return true;
    }catch{return false;}
  }
  async function check(){
    if(!token||document.hidden)return;
    if(expiresAt<=Date.now()/1000){lock();return;}
    if(checkPending||Date.now()-lastCheck<STATUS_INTERVAL)return;
    const epoch=generation;lastCheck=Date.now();
    const pending=(async()=>{try{
      const response=await fetch(`${service}/private-photos/auth/status`,{headers:{Authorization:`Bearer ${token}`},credentials:'omit',cache:'no-store'});
      if(epoch===generation&&response.status===401)lock();
    }catch{/* A transient network outage does not discard valid access. */}})();
    checkPending=pending;
    try{await pending;}finally{if(checkPending===pending)checkPending=null;}
  }
  channel?.addEventListener('message',event=>{if(event.data==='lock')lock(false);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});window.addEventListener('focus',check);setInterval(check,STATUS_INTERVAL);
  for(const button of document.querySelectorAll('[data-unlock]'))button.addEventListener('click',()=>begin());
  dialog.querySelector('[data-dismiss]').addEventListener('click',closePrompt);
  dialog.addEventListener('close',()=>lastFocus?.focus?.());
  window.JOURNEY_ATLAS_AUTH={isProtected,markup,hydrate,prepare,setImage,clearImage,preload(photo,width){if(local||token)fetchPhoto(selected(photo,width),2).then(prune,prune);},lock,showPrompt,get unlocked(){return local||Boolean(token);}};
  const realPage=document.body.dataset.journeyScope!=='demo';status.hidden=!realPage;updateControls();
  if(realPage&&!local){status.querySelector('[data-unlock]').hidden=true;completeReturn();}
})();
