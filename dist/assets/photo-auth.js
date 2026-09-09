(function () {
  'use strict';
  const config = window.JOURNEY_ATLAS_PHOTO_SERVICE || {};
  const local = ['127.0.0.1', 'localhost'].includes(location.hostname) && new URLSearchParams(location.search).get('photoSource') === 'local';
  const protectedPath = /^\/private-photos\/assets\/v1\/[a-f0-9]{64}\.webp$/;
  let service = '';
  try { const url = new URL(config.origin); if (url.origin === config.origin && (url.protocol === 'https:' || (['127.0.0.1','localhost'].includes(location.hostname) && ['127.0.0.1','localhost'].includes(url.hostname)))) service = url.origin; } catch { /* Unconfigured always stays locked. */ }
  let token = '', expiresAt = 0, generation = 0, expiryTimer, lastFocus;
  const images = new Map(), cache = new Map();
  const MAX_CACHE = 12;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="24"%3E%3Cpath fill="%23d4ded8" d="M0 0h32v24H0z"/%3E%3C/svg%3E';
  const isProtected = photo => Boolean(photo?.protected || protectedPath.test(photo?.src || ''));
  const selected = (photo, width=1280) => { const variants=[...(photo.srcset || [])].sort((a,b)=>a.width-b.width);return (variants.find(v=>v.width>=width)||variants.at(-1))?.src||photo.src; };
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('atlas-photo-lock') : null;
  const dialog = document.createElement('dialog'); dialog.className='photo-unlock-dialog';dialog.setAttribute('aria-labelledby','photo-unlock-title');
  dialog.innerHTML='<h2 id="photo-unlock-title">Private photographs</h2><p>The journey is here to explore. Unlock the photos with a shared password.</p><button type="button" data-unlock>Unlock photos</button><p class="photo-unlock-hint">You’ll visit a secure login page, then return here. Access is remembered for 30 days.</p><p data-auth-message role="status" aria-live="polite"></p><button type="button" class="photo-auth-secondary" data-dismiss>Continue without photos</button>';
  document.body.append(dialog);
  const status = document.createElement('span');status.className='photo-auth-controls';
  status.innerHTML='<button type="button" data-unlock>Unlock photos</button><button type="button" data-lock hidden>Lock photos</button><span data-photo-status role="status"></span>';
  (document.querySelector('.header-context')||document.querySelector('.site-header')||document.body).append(status);
  const message = dialog.querySelector('[data-auth-message]');
  function updateControls() {
    status.querySelector('[data-unlock]').hidden=Boolean(token)||local;
    status.querySelector('[data-lock]').hidden=!token||local;
    status.querySelector('[data-photo-status]').textContent=local?'Local photos':token?'Photos unlocked':'Photos locked';
  }
  function release(img) {
    const previous=images.get(img);if(previous?.entry)previous.entry.refs.delete(img);images.delete(img);
  }
  function clearImage(img) {
    release(img);observer?.unobserve(img);delete img.dataset.privateSrc;delete img.dataset.privateBlur;
  }
  function prune() {
    for(const [img] of images)if(!img.isConnected)release(img);
    for(const [key,entry] of cache) {
      if(cache.size<=MAX_CACHE)break;
      if(!entry.refs.size){entry.controller.abort();if(entry.url)URL.revokeObjectURL(entry.url);cache.delete(key);}
    }
  }
  function lock(broadcast=true) {
    token='';expiresAt=0;generation++;clearTimeout(expiryTimer);
    for(const [img,item] of images){img.removeAttribute('srcset');img.src=item.blur;img.classList.remove('is-loaded');item.entry=null;item.loading=false;}
    for(const entry of cache.values()){entry.controller.abort();if(entry.url)URL.revokeObjectURL(entry.url);}
    cache.clear();updateControls();if(broadcast)channel?.postMessage('lock');
    window.dispatchEvent(new Event('atlas-photos-locked'));
  }
  function showPrompt(text='') { message.textContent=text;lastFocus=document.activeElement;if(!dialog.open)dialog.showModal(); }
  function closePrompt(){dialog.close();lastFocus?.focus?.();}
  async function fetchPhoto(src) {
    if(!protectedPath.test(src))throw new Error('Invalid photo');
    if(!local&&(!token||expiresAt<=Date.now()/1000)){if(token)lock();throw new Error('Photos locked');}
    let entry=cache.get(src);if(entry){cache.delete(src);cache.set(src,entry);return entry.promise;}
    const epoch=generation,controller=new AbortController();entry={controller,refs:new Set(),url:null,promise:null};
    entry.promise=(async()=>{
      const response=await fetch(local?`/build/private-photo-assets/${src.slice('/private-photos/assets/'.length)}`:`${service}${src}`,{credentials:'omit',headers:local?{}:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal});
      if(response.status===401){lock();throw new Error('Photos locked');}
      if(!response.ok||response.headers.get('Content-Type')?.split(';')[0]!=='image/webp')throw new Error('Photo could not load');
      const blob=await response.blob();
      if(epoch!==generation||controller.signal.aborted)throw new Error('Photo request cancelled');
      entry.url=URL.createObjectURL(blob);return entry;
    })().catch(error=>{if(cache.get(src)===entry)cache.delete(src);throw error;});
    cache.set(src,entry);prune();return entry.promise;
  }
  async function hydrate(img) {
    const src=img.dataset.privateSrc;if(!src||(!local&&!token))return;
    let item=images.get(img);
    if(!item||item.src!==src){release(img);item={src,blur:img.dataset.privateBlur||placeholder,entry:null};images.set(img,item);}
    if(item.loading||item.entry)return;item.loading=true;const epoch=generation;
    try{const entry=await fetchPhoto(src);if(epoch!==generation||images.get(img)!==item||!img.isConnected)return;entry.refs.add(img);item.entry=entry;img.addEventListener('load',()=>img.classList.add('is-loaded'),{once:true});img.src=entry.url;img.removeAttribute('data-photo-error');}
    catch(error){if(epoch===generation&&token){img.dataset.photoError='true';img.dispatchEvent(new Event('error'));}}
    finally{item.loading=false;prune();}
  }
  function setImage(img,photo,width=1280) {
    release(img);img.removeAttribute('srcset');delete img.dataset.src;delete img.dataset.srcset;
    img.dataset.privateSrc=selected(photo,width);img.dataset.privateBlur=photo.blur||placeholder;img.src=photo.blur||placeholder;img.classList.remove('is-loaded');
    images.set(img,{src:img.dataset.privateSrc,blur:img.dataset.privateBlur,entry:null});hydrate(img);
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
    if(!params.has('photoAuthCode')&&!params.has('photoAuthLogout')&&!params.has('photoAuthCancel'))return;
    let flow;try{flow=JSON.parse(sessionStorage.getItem(FLOW_KEY));sessionStorage.removeItem(FLOW_KEY);}catch{}
    // Remove the short-lived one-use code before loading anything else from this page.
    history.replaceState(null,'',location.pathname+location.search+(flow?.hash||''));
    if(!flow||params.get('state')!==flow.state||Date.now()-flow.created>300000){showPrompt('Login expired. Please unlock again.');return;}
    if(params.has('photoAuthLogout')||params.has('photoAuthCancel')){lock();if(dialog.open)closePrompt();return;}
    message.textContent='Restoring photo access…';
    const epoch=generation;
    try{
      const response=await fetch(`${service}/private-photos/auth/redeem`,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:params.get('photoAuthCode'),verifier:flow.verifier})});
      const data=await response.json();
      if(epoch!==generation)return;
      if(!response.ok||typeof data.token!=='string'||!Number.isInteger(data.expiresAt)||data.expiresAt<=Date.now()/1000||data.expiresAt>Date.now()/1000+3630)throw new Error('Login expired. Please unlock again.');
      lock(false);token=data.token;expiresAt=data.expiresAt;expiryTimer=setTimeout(()=>lock(),Math.max(0,expiresAt*1000-Date.now()));
      updateControls();if(dialog.open)closePrompt();for(const [img] of images)if(img.isConnected)hydrate(img);prepare();window.dispatchEvent(new Event('atlas-photos-unlocked'));
    }catch{showPrompt('Could not restore photo access. Please unlock again.');}
  }
  async function check(){if(!token||document.hidden)return;try{const response=await fetch(`${service}/private-photos/auth/status`,{headers:{Authorization:`Bearer ${token}`},credentials:'omit',cache:'no-store'});if(response.status===401)lock();}catch{/* A transient network outage does not discard valid access. */}}
  channel?.addEventListener('message',event=>{if(event.data==='lock')lock(false);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});window.addEventListener('focus',check);setInterval(check,60000);
  for(const button of document.querySelectorAll('[data-unlock]'))button.addEventListener('click',()=>begin());
  status.querySelector('[data-lock]').addEventListener('click',()=>begin('logout'));dialog.querySelector('[data-dismiss]').addEventListener('click',closePrompt);
  dialog.addEventListener('close',()=>lastFocus?.focus?.());
  window.JOURNEY_ATLAS_AUTH={isProtected,markup,hydrate,prepare,setImage,clearImage,preload(photo,width){if(local||token)fetchPhoto(selected(photo,width)).catch(()=>{});},lock,showPrompt,get unlocked(){return local||Boolean(token);}};
  const realPage=document.body.dataset.journeyScope!=='demo';status.hidden=!realPage;updateControls();
  if(realPage&&!local){showPrompt();completeReturn();}
})();
