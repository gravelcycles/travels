(function () {
  'use strict';
  const config = window.JOURNEY_ATLAS_PHOTO_SERVICE || {};
  const local = ['127.0.0.1', 'localhost'].includes(location.hostname) && new URLSearchParams(location.search).get('photoSource') === 'local';
  const protectedPath = /^\/private-photos\/assets\/v1\/[a-f0-9]{64}\.webp$/;
  let service = '';
  try { const url = new URL(config.origin); if (url.origin === config.origin && (url.protocol === 'https:' || (['127.0.0.1','localhost'].includes(location.hostname) && ['127.0.0.1','localhost'].includes(url.hostname)))) service = url.origin; } catch { /* Unconfigured always stays locked. */ }
  let token = '', expiresAt = 0, generation = 0, expiryTimer, lastFocus, restoreAfterExpiry=false;
  const ACCESS_KEY='atlas-photo-access', RECOVERY_KEY='atlas-photo-recovery';
  const images = new Map(), cache = new Map();
  const MAX_CACHE = 96, MAX_CACHE_BYTES = 64 * 1024 * 1024;
  const STATUS_INTERVAL = 60000;
  const REQUEST_TIMEOUT = 15000, MAX_TRANSFER_TIME = 120000, MAX_DOWNLOADS = 4;
  const MAX_PREFETCH = 6, MAX_PHOTO_BYTES = 16 * 1024 * 1024;
  const preloadTargets = new Set(), preloadFailures = new Set(), freshSources = new Set();
  let pumping = false, navigationPending = false;
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
    const previous=images.get(img);previous?.cleanup?.();if(previous?.entry)previous.entry.refs.delete(img);images.delete(img);
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
    token='';expiresAt=0;generation++;lastCheck=0;checkPending=null;restoreAfterExpiry=false;navigationPending=false;clearTimeout(expiryTimer);
    preloadTargets.clear();preloadFailures.clear();
    try{sessionStorage.removeItem(ACCESS_KEY);}catch{}
    for(const [img,item] of images){item.cleanup?.();img.removeAttribute('srcset');img.src=item.blur;img.classList.remove('is-loaded');item.entry=null;item.loading=false;imageState(img,'locked');}
    for(const entry of cache.values()){entry.controller.abort();if(entry.url)URL.revokeObjectURL(entry.url);}
    cache.clear();updateControls();if(broadcast)channel?.postMessage('lock');
    window.dispatchEvent(new Event('atlas-photos-locked'));
  }
  function expireAccess() {
    if (!token) return;
    // Guard survives the round trip: a newly issued but rejected token cannot loop.
    let recent = false;
    try {
      const previous = Number(sessionStorage.getItem(RECOVERY_KEY));
      recent = previous > 0 && Date.now() - previous < STATUS_INTERVAL;
      if (!recent) sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
    } catch { /* Session storage failures are handled by begin(). */ }
    lock(false);
    if (recent) { showPrompt('Photo access could not be restored. Please unlock again.'); return; }
    restoreAfterExpiry = true;
    check();
  }
  async function requestJson(url, options = {}) {
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Photo access timed out. Please try again.')); }, REQUEST_TIMEOUT);
    });
    try {
      return await Promise.race([(async () => {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return { response, data: await response.json() };
      })(), timeout]);
    } finally { clearTimeout(timer); }
  }
  function showPrompt(text='') { updateControls();message.textContent=text;lastFocus=document.activeElement;if(!dialog.open)dialog.showModal(); }
  function closePrompt(){dialog.close();lastFocus?.focus?.();}
  function abortEntry(src, entry) {
    if (cache.get(src) === entry) cache.delete(src);
    entry.controller.abort();
  }
  function speculationAllowed() {
    const connection = window.navigator?.connection;
    return !document.hidden && !connection?.saveData && !['slow-2g', '2g'].includes(connection?.effectiveType)
      && ![...images].some(([img, item]) => img.isConnected && item.priority === 0 && ['loading', 'error'].includes(img.dataset.photoState))
      && !downloadQueue.some(entry => entry.priority < 2)
      && ![...activeDownloads].some(entry => entry.priority < 2);
  }
  function setPreloadSources(sources) {
    const next = new Set(sources.filter(src => protectedPath.test(src)).slice(0, MAX_PREFETCH));
    for (const src of preloadFailures) if (!next.has(src)) preloadFailures.delete(src);
    preloadTargets.clear();for (const src of next) preloadTargets.add(src);
    for (const [src, entry] of cache) if (!entry.url && entry.priority === 2 && !next.has(src)) abortEntry(src, entry);
    pumpDownloads();
  }
  function setPreloads(requests = []) {
    setPreloadSources(requests.filter(request => isProtected(request.photo)).map(({photo, width}) => selected(photo, width)));
  }
  function pumpDownloads() {
    if (pumping || (!local && !token)) return;
    pumping = true;
    try {
      const speculative = speculationAllowed();
      if (!speculative) for (const entry of activeDownloads) if (entry.priority === 2) abortEntry(entry.src, entry);
      downloadQueue.sort((a, b) => a.priority - b.priority);
      while (activeDownloads.size < MAX_DOWNLOADS) {
        const next = downloadQueue[0];
        if (!next) break;
        if (next.priority === 2 && (!speculative || activeDownloads.size)) break;
        // One slot remains available for the selected photo, even with many thumbnails.
        if (next.priority === 1 && [...activeDownloads].filter(entry => entry.priority === 1).length >= MAX_DOWNLOADS - 1) break;
        downloadQueue.shift();activeDownloads.add(next);next.run();
      }
      // Only one speculative transfer, and only after all visible work is ready.
      if (speculative && !activeDownloads.size && !downloadQueue.length) {
        const src = [...preloadTargets].find(src => !cache.has(src) && !preloadFailures.has(src));
        if (src) {
          fetchPhoto(src, 2).then(prune, prune);
          const next = downloadQueue.shift();
          if (next) { activeDownloads.add(next);next.run(); }
        }
      }
    } finally { pumping = false; }
  }
  async function download(src, entry, epoch) {
    const overallStarted = Date.now();
    for (let attempt = 0; attempt < (entry.priority === 2 ? 1 : 2); attempt++) {
      if (entry.controller.signal.aborted || epoch !== generation) throw new Error('Photo request cancelled');
      const controller = new AbortController(), abort = () => controller.abort();
      entry.controller.signal.addEventListener('abort', abort, {once:true});
      let idleTimer, reader;
      const progress = () => { clearTimeout(idleTimer);idleTimer = setTimeout(abort, REQUEST_TIMEOUT); };
      const overallTimer = setTimeout(abort, MAX_TRANSFER_TIME);
      progress();
      try {
        const started = Date.now();
        const response = await fetch(local ? `/build/private-photo-assets/${src.slice('/private-photos/assets/'.length)}` : `${service}${src}`, {
          credentials:'omit', headers:local ? {} : {Authorization:`Bearer ${token}`},
          cache:local ? 'no-store' : freshSources.has(src) ? 'reload' : 'no-cache',
          signal:controller.signal, priority:entry.priority < 2 ? 'high' : 'low'
        });
        entry.headersMs = Date.now() - started;
        if (response.status === 401) { if (epoch === generation) expireAccess();throw new Error('Photos locked'); }
        if (!response.ok) { const error = new Error('Photo could not load');error.photoFailure = `HTTP ${response.status}`;error.permanent = response.status < 500 && ![408,429].includes(response.status);throw error; }
        if (response.headers.get('Content-Type')?.split(';')[0] !== 'image/webp') { const error = new Error('Invalid photo response');error.permanent = true;throw error; }
        progress();
        let blob;
        if (response.body?.getReader) {
          reader = response.body.getReader();
          const chunks = [];let bytes = 0;
          while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            if (controller.signal.aborted) throw new Error('Photo request cancelled');
            if (value.length) { bytes += value.length;progress(); }
            if (bytes > MAX_PHOTO_BYTES) { const error = new Error('Photo too large');error.permanent = true;throw error; }
            chunks.push(value);
          }
          blob = new Blob(chunks, {type:'image/webp'});
        } else blob = await response.blob();
        if (epoch !== generation || entry.controller.signal.aborted || controller.signal.aborted) throw new Error('Photo request cancelled');
        entry.bytes = blob.size;entry.bodyMs = Date.now() - started - entry.headersMs;entry.attempts = attempt + 1;
        entry.downloadMs = Date.now() - overallStarted;entry.edgeCache = response.headers.get('X-Photo-Cache') || 'UNKNOWN';
        entry.revalidated = response.headers.get('X-Photo-Revalidated') === '1';entry.serverTiming = response.headers.get('Server-Timing') || '';
        entry.url = URL.createObjectURL(blob);freshSources.delete(src);return entry;
      } catch (error) {
        if (controller.signal.aborted && !entry.controller.signal.aborted) error.photoFailure = 'timeout';
        if (attempt === 1 || entry.priority === 2 || error.permanent || epoch !== generation || entry.controller.signal.aborted) throw error;
      } finally {
        clearTimeout(idleTimer);clearTimeout(overallTimer);entry.controller.signal.removeEventListener('abort', abort);
        // Stop a rejected/error response as well as its body, then free the reader.
        controller.abort();if (reader) { reader.cancel().catch(() => {});reader.releaseLock(); }
      }
    }
  }
  async function fetchPhoto(src, priority = 1) {
    if (!protectedPath.test(src)) throw new Error('Invalid photo');
    if (!local && (!token || expiresAt <= Date.now()/1000)) { if (token) expireAccess();throw new Error('Photos locked'); }
    let entry = cache.get(src);
    if (entry) { cache.delete(src);cache.set(src, entry);entry.priority = Math.min(entry.priority, priority);pumpDownloads();return entry.promise; }
    const epoch = generation, controller = new AbortController();
    entry = {src, controller, priority, refs:new Set(), url:null, promise:null, bytes:0, queuedAt:Date.now()};
    entry.promise = new Promise((resolve, reject) => {
      const onAbort = () => { const index = downloadQueue.indexOf(entry);if (index >= 0) { downloadQueue.splice(index,1);reject(new Error('Photo request cancelled')); } };
      controller.signal.addEventListener('abort', onAbort, {once:true});
      entry.run = () => {
        entry.queueMs = Date.now() - entry.queuedAt;
        download(src, entry, epoch).then(resolve, reject).finally(() => {
          controller.signal.removeEventListener('abort', onAbort);activeDownloads.delete(entry);pumpDownloads();
        });
      };
    }).catch(error => {
      if (cache.get(src) === entry) cache.delete(src);
      if (entry.priority === 2 && !controller.signal.aborted && epoch === generation) preloadFailures.add(src);
      throw error;
    });
    cache.set(src, entry);downloadQueue.push(entry);pumpDownloads();prune();return entry.promise;
  }
  function imageState(img,state) {
    img.dataset.photoState=state;img.dispatchEvent(new Event('atlas-photo-state'));pumpDownloads();
  }
  function display(img,item,entry) {
    item.cleanup?.();
    item.entry?.refs.delete(img);item.entry=entry;entry.refs.add(img);
    img.dataset.photoCache=entry.edgeCache;img.dataset.photoBrowserCache=entry.revalidated?'revalidated':'download';img.dataset.photoDownloadMs=String(entry.downloadMs);img.dataset.photoServerTiming=entry.serverTiming;
    const decodeStarted=Date.now();
    img.dataset.photoQueueMs=String(entry.queueMs);img.dataset.photoHeadersMs=String(entry.headersMs);img.dataset.photoBodyMs=String(entry.bodyMs);img.dataset.photoAttempts=String(entry.attempts);
    let settled=false;
    const current=()=>!settled&&images.get(img)===item&&item.entry===entry&&img.src===entry.url;
    const cleanup=()=>{settled=true;img.removeEventListener('load',loaded);img.removeEventListener('error',failed);};
    const failed=()=>{
      if(!current())return;
      cleanup();entry.decoded=false;freshSources.add(entry.src);
      if(cache.get(entry.src)===entry)cache.delete(entry.src);
      for(const consumer of entry.refs){
        const owner=images.get(consumer);if(owner?.entry!==entry)continue;
        owner.cleanup?.();owner.entry=null;consumer.src=owner.blur;consumer.classList.remove('is-loaded');consumer.dataset.photoFailure='decode';imageState(consumer,'error');
      }
      entry.refs.clear();URL.revokeObjectURL(entry.url);prune();
    };
    const ready=()=>{if(current()){cleanup();img.dataset.photoDecodeMs=String(Date.now()-decodeStarted);entry.decoded=true;img.classList.add('is-loaded');imageState(img,'ready');}};
    // A normal load event is authoritative even if decode() rejects or stalls.
    // Ignore queued load events from the old placeholder while a new source loads.
    const loaded=()=>{
      if(!current()){cleanup();return;}
      if(!img.complete||!img.naturalWidth||(img.currentSrc&&img.currentSrc!==entry.url))return;
      ready();
    };
    item.cleanup=cleanup;
    img.addEventListener('load',loaded);
    img.addEventListener('error',failed);
    if(!entry.decoded&&(item.fullOnly||img.dataset.photoState!=='ready'))imageState(img,'loading');
    img.src=entry.url;delete img.dataset.photoError;delete img.dataset.photoFailure;
    // A previously displayed blob can be reused without flashing the loading UI.
    if(entry.decoded)ready();
    else if(img.decode)img.decode().then(ready,loaded);
    else loaded();
  }
  async function hydrate(img) {
    const src=img.dataset.privateSrc;if(!src||(!local&&!token))return;
    let item=images.get(img);
    if(!item||item.src!==src){release(img);item={src,blur:img.dataset.privateBlur||placeholder,entry:null,priority:1};images.set(img,item);}
    if(item.loading||(item.entry&&item.entry===cache.get(src)))return;
    item.loading=true;const epoch=generation;
    const current=()=>epoch===generation&&images.get(img)===item&&img.isConnected;
    const pending=cache.get(src);if(pending)pending.priority=Math.min(pending.priority,item.priority??1);
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
  function setImage(img,photo,width=1280,{fullOnly=false}={}) {
    const src=selected(photo,fullOnly?Infinity:width),preview=fullOnly?src:selected(photo,1280),thumbnail=fullOnly?src:selected(photo,480);
    if(token&&expiresAt<=Date.now()/1000)expireAccess();
    const pending=cache.get(src);if(pending)pending.priority=0;
    const previous=images.get(img);
    if(previous?.src===src&&previous.loading&&img.dataset.photoState!=='error'){for(const key of [src,preview]){const pending=cache.get(key);if(pending)pending.priority=0;}if(img.dataset.photoState==='ready')img.classList.add('is-loaded');imageState(img,img.dataset.photoState||'loading');pumpDownloads();return;}
    const ready=(local||token)?[src,preview,thumbnail].map(key=>cache.get(key)).find(entry=>entry?.url):null;
    if(ready&&images.get(img)?.entry===ready&&images.get(img)?.src===src&&img.src===ready.url&&img.dataset.photoState==='ready'){img.classList.add('is-loaded');imageState(img,'ready');hydrate(img);return;}
    release(img);img.removeAttribute('srcset');delete img.dataset.src;delete img.dataset.srcset;delete img.dataset.photoError;
    img.dataset.privateSrc=src;img.dataset.privateBlur=fullOnly?placeholder:photo.blur||placeholder;
    const item={src,preview,fullOnly,blur:img.dataset.privateBlur,entry:null,priority:0};images.set(img,item);
    img.dataset.photoReveal=ready?.decoded?'instant':'soft';
    if(ready){display(img,item,ready);prune();}
    else {img.src=item.blur;img.classList.remove('is-loaded');imageState(img,(local||token)?'loading':'locked');}
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
    if(navigationPending)return;
    if(!service){showPrompt('Photo access is being prepared. Please return soon.');return;}
    if(action==='logout')lock();
    if(action==='login')try{sessionStorage.removeItem(RECOVERY_KEY);}catch{}
    navigationPending=true;const epoch=generation;
    const state=randomState(),verifier=randomState();
    const challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    if(epoch!==generation)return;
    const returnTo=location.origin+location.pathname+location.search;
    try{sessionStorage.setItem(FLOW_KEY,JSON.stringify({state,verifier,hash:location.hash,created:Date.now()}));}
    catch{navigationPending=false;showPrompt('Allow session storage for this site to complete the secure login.');return;}
    location.assign(`${service}/private-photos/auth/window?${new URLSearchParams({origin:location.origin,state,challenge,returnTo,action})}`);
  }
  async function completeReturn() {
    const params=new URLSearchParams(location.hash.slice(1));
    if(!params.has('photoAuthCode')&&!params.has('photoAuthLogout')&&!params.has('photoAuthCancel')&&!params.has('photoAuthMissing')){if(!await restoreTabAccess())await begin('restore');return;}
    let flow;try{flow=JSON.parse(sessionStorage.getItem(FLOW_KEY));sessionStorage.removeItem(FLOW_KEY);}catch{}
    // Remove the short-lived one-use code before loading anything else from this page.
    history.replaceState(null,'',location.pathname+location.search+(flow?.hash||''));
    window.dispatchEvent(new Event('hashchange'));
    if(!flow||params.get('state')!==flow.state||Date.now()-flow.created>300000){showPrompt('Login expired. Please unlock again.');return;}
    if(params.has('photoAuthMissing')){showPrompt();return;}
    if(params.has('photoAuthLogout')||params.has('photoAuthCancel')){lock();if(dialog.open)closePrompt();return;}
    const epoch=generation;
    try{
      const {response,data}=await requestJson(`${service}/private-photos/auth/redeem`,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:params.get('photoAuthCode'),verifier:flow.verifier})});
      if(epoch!==generation)return;
      if(!response.ok||!validAccess(data))throw new Error('Login expired. Please unlock again.');
      acceptAccess(data);
    }catch{if(epoch===generation)showPrompt('Could not restore photo access. Please unlock again.');}
  }
  function validAccess(data){return typeof data?.token==='string'&&data.token.length<=2048&&Number.isInteger(data.expiresAt)&&data.expiresAt>Date.now()/1000&&data.expiresAt<=Date.now()/1000+3630;}
  function acceptAccess(data){
    lock(false);token=data.token;expiresAt=data.expiresAt;lastCheck=Date.now();
    // Only the one-hour access token is tab-scoped; the 30-day cookie stays HttpOnly.
    try{sessionStorage.setItem(ACCESS_KEY,JSON.stringify({token,expiresAt}));}catch{}
    expiryTimer=setTimeout(expireAccess,Math.max(0,expiresAt*1000-Date.now()));
    updateControls();if(dialog.open)closePrompt();for(const [img,item] of images)if(img.isConnected&&item.priority===0)hydrate(img);prepare();window.dispatchEvent(new Event('atlas-photos-unlocked'));
  }
  async function restoreTabAccess(){
    let saved;try{saved=JSON.parse(sessionStorage.getItem(ACCESS_KEY));}catch{}
    if(!validAccess(saved))return false;
    const epoch=generation;
    try{
      const {response,data}=await requestJson(`${service}/private-photos/auth/status`,{headers:{Authorization:`Bearer ${saved.token}`},credentials:'omit',cache:'no-store'});
      if(epoch!==generation)return true;
      if(response.status===401)return false;
      if(!response.ok||data.unlocked!==true||data.expiresAt!==saved.expiresAt)throw new Error('Photo access unavailable');
      acceptAccess(saved);return true;
    }catch{if(epoch===generation)showPrompt('Photo access is taking too long or unavailable. Please try unlocking again.');return true;}
  }
  async function check(){
    if(document.hidden)return;
    if(restoreAfterExpiry){restoreAfterExpiry=false;window.dispatchEvent(new Event('atlas-photos-renewing'));await begin('restore');return;}
    if(!token)return;
    if(expiresAt<=Date.now()/1000){expireAccess();return;}
    if(checkPending||Date.now()-lastCheck<STATUS_INTERVAL)return;
    const epoch=generation;lastCheck=Date.now();
    const pending=(async()=>{try{
      const {response}=await requestJson(`${service}/private-photos/auth/status`,{headers:{Authorization:`Bearer ${token}`},credentials:'omit',cache:'no-store'});
      if(epoch===generation&&response.status===401)expireAccess();
    }catch{/* A transient network outage does not discard valid access. */}})();
    checkPending=pending;
    try{await pending;}finally{if(checkPending===pending)checkPending=null;}
  }
  channel?.addEventListener('message',event=>{if(event.data==='lock')lock(false);});
  document.addEventListener('visibilitychange',()=>{pumpDownloads();if(!document.hidden)check();});window.navigator?.connection?.addEventListener('change',pumpDownloads);window.addEventListener('focus',check);setInterval(check,STATUS_INTERVAL);
  for(const button of document.querySelectorAll('[data-unlock]'))button.addEventListener('click',()=>begin());
  dialog.querySelector('[data-dismiss]').addEventListener('click',closePrompt);
  dialog.addEventListener('close',()=>lastFocus?.focus?.());
  window.JOURNEY_ATLAS_AUTH={isProtected,markup,hydrate,prepare,setImage,clearImage,setPreloads,preload(photo,width){if(isProtected(photo))setPreloadSources([...preloadTargets,selected(photo,width)].slice(-MAX_PREFETCH));},lock,showPrompt,get unlocked(){return local||Boolean(token);}};
  const realPage=document.body.dataset.journeyScope!=='demo';status.hidden=!realPage;updateControls();
  if(realPage&&!local){status.querySelector('[data-unlock]').hidden=true;completeReturn();}
})();
