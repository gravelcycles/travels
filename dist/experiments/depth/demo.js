const $=id=>document.getElementById(id);
const viewer=$('viewer'),still=$('still'),frame=$('image-frame'),canvas=$('depth-canvas');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let samples=[],index=0,enabled=false,loading=false,paused=false,comparing=false,mode='drag';
let renderer=null,epoch=0,raf=0,last=0,elapsed=0,amount=0,x=0,y=0,targetX=0,targetY=0,ready=false,opener=null;
let drag=null;
const limits={x:.0234,y:.0117};
const clamp=(value,limit)=>Math.max(-limit,Math.min(limit,value));
const level=()=>Number($('strength').value)/100;
let auth=window.JOURNEY_ATLAS_AUTH;
async function loadAuth(){
  if(auth)return;
  await new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=new URL('../../assets/photo-auth.js',import.meta.url).href;
    script.onload=resolve;script.onerror=()=>reject(new Error('Trip photo access could not load. Please reload to try again.'));
    document.body.append(script);
  });
  auth=window.JOURNEY_ATLAS_AUTH;
}
const cache=new Map(),privateLeases=new Map();
const protectedPath=url=>/^\/private-photos\/assets\/v1\/[a-f0-9]{64}\.webp$/.test(url);
let privateEpoch=0;
function clearPrivateImages(){
  privateEpoch++;
  for(const [url,entry] of privateLeases){entry.img.removeAttribute('src');entry.lease.release();cache.delete(url);}
  privateLeases.clear();
  for(const key of cache.keys())if(protectedPath(key))cache.delete(key);
}
const image=(url,errorMessage='This photo could not load. Please try again.')=>{
  if(cache.has(url))return cache.get(url);
  const token=privateEpoch;
  const promise=(async()=>{
    let lease=null;
    if(protectedPath(url)){
      if(!auth?.unlocked)throw new Error('Unlock trip photos with your usual atlas password.');
      lease=await auth.acquirePoster(url);
      if(token!==privateEpoch){lease.release();throw new Error('Photo access changed.');}
    }
    const img=new Image();
    try{
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error(errorMessage));img.src=lease?lease.url:url;});
      if(lease){
        if(token!==privateEpoch)throw new Error('Photo access changed.');
        privateLeases.set(url,{img,lease});
      }
      return img;
    }catch(error){img.removeAttribute('src');lease?.release();throw error;}
  })();
  cache.set(url,promise);promise.catch(()=>{if(cache.get(url)===promise)cache.delete(url);});return promise;
};
const asset=file=>protectedPath(file)?file:new URL(`./assets/${file}`,import.meta.url).href;
function clearRenderer(){
  renderer?.dispose();renderer=null;canvas.width=canvas.width;
  frame.classList.remove('is-active','is-comparing');
}
function syncPrivateThumbnails(){
  for(const button of document.querySelectorAll('[data-protected]'))button.classList.toggle('is-locked',!auth?.unlocked);
}
const status=message=>$('status').textContent=message;
function fit(){
  if(!ready)return;
  const stage=$('stage'),padding=innerWidth<=700?24:48;
  const w=Math.max(1,stage.clientWidth-padding),h=Math.max(1,stage.clientHeight-padding);
  const ratio=still.naturalWidth/still.naturalHeight;
  const width=Math.min(w,h*ratio),height=width/ratio;
  frame.style.width=`${width}px`;frame.style.height=`${height}px`;renderer?.resize(width,height);schedule();
}
function sync(){
  frame.classList.toggle('is-interactive',enabled&&!loading);
  frame.classList.toggle('is-dragging',Boolean(drag));
  frame.tabIndex=enabled&&!loading?0:-1;
  $('depth-toggle').setAttribute('aria-checked',String(enabled));
  $('toggle-label').textContent=loading?'Preparing…':enabled?'On':'Off';
  $('motion-controls').disabled=!enabled||loading;
  $('depth-toggle').disabled=!ready;
  $('unlock-photo').hidden=!samples[index]?.protected||Boolean(auth?.unlocked);
  $('drift-mode').setAttribute('aria-pressed',String(mode==='drift'));
  $('drag-mode').setAttribute('aria-pressed',String(mode==='drag'));
  $('pointer-mode').setAttribute('aria-pressed',String(mode==='pointer'));
  frame.classList.toggle('is-pointer',mode==='pointer');
  $('pause').hidden=mode!=='drift';$('reset-view').hidden=mode==='drift';
  $('pause').textContent=paused?'Resume':'Pause';$('pause').setAttribute('aria-pressed',String(paused));
  $('stage-badge').textContent=comparing||!enabled?'Original':loading?'Preparing depth':level()===0?'Still · 0%':drag?'Drag to explore':paused?'Depth · paused':mode==='drag'?'Drag to explore':mode==='pointer'?'Move your mouse':'Gentle drift';
  $('previous').disabled=index===0;$('next').disabled=index===samples.length-1;
}
function modeStatus(){status(mode==='drift'?'A gentle drift. Drag the photo to take control.':mode==='pointer'?'Move your mouse over the photo. Drag to hold a viewpoint.':'Drag to look around; release to hold. Arrow keys move the focused photo; Home resets.');}
function stop(){cancelAnimationFrame(raf);raf=0;last=0;}
function cancelDrag(){
  if(!drag)return;
  const id=drag.id;drag=null;
  if(frame.hasPointerCapture(id))frame.releasePointerCapture(id);
  frame.classList.remove('is-dragging');
}
function disable(){
  cancelDrag();
  epoch++;enabled=false;loading=false;paused=false;comparing=false;amount=0;x=0;y=0;targetX=0;targetY=0;elapsed=0;
  stop();frame.classList.remove('is-active','is-comparing');status('The original photograph.');sync();
}
async function enable(){
  const token=++epoch;enabled=true;loading=true;paused=false;sync();status('Preparing depth motion…');
  try{
    // The build versions this script using both modules, so upgrades also fetch
    // the matching lazily loaded renderer instead of a cached older API.
    const [{DepthRenderer},depth]=await Promise.all([import(`./renderer.js${new URL(import.meta.url).search}`),image(asset(samples[index].depth),'Depth motion could not load. The original photo is still available. Try again.')]);
    if(token!==epoch||!viewer.open||!enabled)return;
    renderer??=new DepthRenderer(canvas);renderer.setImages(still,depth);fit();
    loading=false;amount=0;elapsed=0;sync();modeStatus();schedule();
  }catch(error){if(token!==epoch)return;disable();status(error.message||'Depth motion could not start. Please try again.');}
}
function schedule(){if(!raf&&viewer.open&&enabled&&!loading&&!document.hidden&&!comparing)raf=requestAnimationFrame(tick);}
function tick(time){
  raf=0;if(!enabled||loading||!viewer.open||document.hidden||comparing)return;
  const dt=last?Math.min((time-last)/1000,.05):1/60;last=time;
  if(!paused){
    elapsed+=dt;
    if(mode==='drift'){targetX=Math.sin(elapsed*.34)*limits.x;targetY=Math.sin(elapsed*.26)*limits.y;}
    const ease=drag||reduced.matches?1:1-Math.exp(-dt*12);x+=(targetX-x)*ease;y+=(targetY-y)*ease;
  }
  amount=reduced.matches?1:Math.min(1,amount+dt*2.5);
  renderer.draw(x,y,amount,level());frame.classList.add('is-active');
  // No animation loop for flat, paused or settled drag views, hidden tabs or stills.
  if(amount<1||(level()>0&&!paused&&(mode==='drift'||Math.abs(targetX-x)+Math.abs(targetY-y)>.00001)))schedule();else last=0;
}
async function select(next){
  if(next<0||next>=samples.length)return;
  disable();clearRenderer();clearPrivateImages();still.removeAttribute('src');index=next;const token=++epoch;ready=false;sync();
  if(history.state?.depthDemo)history.replaceState({...history.state,photo:index},'',`#photo-${index+1}`);
  $('photo-count').textContent=`${index+1} / ${samples.length}`;
  [...$('filmstrip').children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
  const strip=$('filmstrip'),selected=strip.children[index];
  if(selected)strip.scrollLeft=Math.max(0,selected.offsetLeft-strip.offsetLeft-(strip.clientWidth-selected.clientWidth)/2);
  status('Loading photograph…');
  const sample=samples[index];
  $('credit').replaceChildren();
  const link=document.createElement('a');link.href=sample.sourceUrl;link.target='_blank';link.rel='noopener';link.textContent=sample.credit;
  $('credit').append(link);
  if(sample.licenseUrl){
    const license=document.createElement('a');license.href=sample.licenseUrl;license.target='_blank';license.rel='noopener';license.textContent=sample.license;
    $('credit').append(' · ',license);
  }else if(sample.protected)$('credit').append(' · Private photo');
  if(sample.protected&&!auth?.unlocked){status('Unlock this trip photo with your usual atlas password.');return;}
  try{
    const loaded=await image(asset(sample.image));if(token!==epoch)return;
    still.src=loaded.src;still.alt=sample.alt||'Trip photograph';ready=true;
    fit();sync();status('The original photograph.');
  }catch(error){if(token===epoch){still.removeAttribute('src');status(error.message);}}
}
function open(next,button){opener=button;history.pushState({depthDemo:true,fromIntro:true,photo:next},'',`#photo-${next+1}`);viewer.showModal();select(next);$('back').focus();if(samples[next]?.protected&&!auth?.unlocked)auth?.showPrompt();}
function close(){disable();clearRenderer();clearPrivateImages();still.removeAttribute('src');viewer.close();if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});opener?.focus();}
function back(){if(history.state?.depthDemo)history.back();else close();}
function compare(on){if(on)cancelDrag();comparing=on&&enabled&&!loading;frame.classList.toggle('is-comparing',comparing);sync();if(comparing)stop();else schedule();}
function setMode(next){cancelDrag();mode=next;paused=false;targetX=x;targetY=y;sync();if(enabled){modeStatus();schedule();}}
function resetView(){setMode('drag');targetX=0;targetY=0;schedule();}
$('depth-toggle').onclick=()=>enabled?disable():enable();
$('unlock-photo').onclick=()=>auth?.begin();
addEventListener('atlas-photos-locked',()=>{
  clearPrivateImages();syncPrivateThumbnails();
  if(samples[index]?.protected){disable();clearRenderer();still.removeAttribute('src');ready=false;sync();status('Trip photos are locked. Unlock to view this photo.');}
});
addEventListener('atlas-photos-unlocked',()=>{syncPrivateThumbnails();if(viewer.open&&samples[index]?.protected)select(index);});
$('back').onclick=back;viewer.addEventListener('cancel',event=>{event.preventDefault();back();});
addEventListener('popstate',event=>{
  const photo=event.state?.photo;
  if(event.state?.depthDemo&&Number.isInteger(photo)&&photo>=0&&photo<samples.length){
    opener=$('samples').children[photo];
    if(!viewer.open)viewer.showModal();
    select(photo);$('back').focus();
  }else if(viewer.open)close();
});
$('previous').onclick=()=>select(index-1);$('next').onclick=()=>select(index+1);
$('pointer-mode').onclick=()=>setMode('pointer');$('drift-mode').onclick=()=>setMode('drift');$('drag-mode').onclick=()=>setMode('drag');
$('reset-view').onclick=resetView;
$('pause').onclick=()=>{paused=!paused;sync();schedule();};
function updateDepth(){
  const value=Number($('strength').value);
  $('strength-value').textContent=`${value}%`;
  $('strength').setAttribute('aria-valuetext',value===0?'Still, no movement':`${value} percent, gentle movement`);
  sync();schedule();
}
$('strength').oninput=updateDepth;
const compareButton=$('compare');
compareButton.addEventListener('pointerdown',event=>{compareButton.setPointerCapture(event.pointerId);compare(true);});
for(const event of ['pointerup','pointercancel','lostpointercapture','blur'])compareButton.addEventListener(event,()=>compare(false));
compareButton.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();compare(true);}});
compareButton.addEventListener('keyup',()=>compare(false));
frame.addEventListener('pointerdown',event=>{
  if(!enabled||loading||comparing)return;
  if(!event.isPrimary){cancelDrag();return;}
  if(event.button!==0)return;
  setMode('drag');
  const rect=frame.getBoundingClientRect();
  drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,x,y,width:rect.width,height:rect.height};
  frame.setPointerCapture(event.pointerId);frame.focus({preventScroll:true});sync();
});
frame.addEventListener('pointermove',event=>{
  if(!enabled||loading||comparing)return;
  if(drag&&event.pointerId===drag.id){
    targetX=clamp(drag.x+(event.clientX-drag.startX)/drag.width*limits.x*4,limits.x);
    targetY=clamp(drag.y-(event.clientY-drag.startY)/drag.height*limits.y*4,limits.y);
  }else if(mode==='pointer'&&event.pointerType==='mouse'){
    const rect=frame.getBoundingClientRect();
    targetX=clamp(((event.clientX-rect.left)/rect.width-.5)*limits.x*2,limits.x);
    targetY=clamp(-((event.clientY-rect.top)/rect.height-.5)*limits.y*2,limits.y);
  }else return;
  schedule();
});
frame.addEventListener('pointerleave',()=>{if(mode==='pointer'&&!drag){targetX=0;targetY=0;schedule();}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])frame.addEventListener(event,input=>{
  if(!drag||input.pointerId!==drag.id)return;
  cancelDrag();sync();schedule();
});
frame.addEventListener('keydown',event=>{
  if(!enabled||loading||comparing||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();
  if(event.key==='Home'){resetView();return;}
  if(mode!=='drag')setMode('drag');else cancelDrag();
  const step=event.shiftKey ? .008 : .003;
  if(event.key==='ArrowLeft')targetX=clamp(targetX-step,limits.x);
  if(event.key==='ArrowRight')targetX=clamp(targetX+step,limits.x);
  if(event.key==='ArrowUp')targetY=clamp(targetY+step,limits.y);
  if(event.key==='ArrowDown')targetY=clamp(targetY-step,limits.y);
  schedule();
});
frame.addEventListener('dragstart',event=>event.preventDefault());
addEventListener('blur',()=>{cancelDrag();compare(false);});
$('expand').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else status('This photo already fills your browser. Device fullscreen is not supported here.');}catch{status('This photo already fills your browser. Device fullscreen is unavailable.');}};
document.addEventListener('fullscreenchange',()=>{const expanded=Boolean(document.fullscreenElement);$('expand').setAttribute('aria-label',expanded?'Exit device fullscreen':'Use device fullscreen');$('expand').querySelector('span').textContent=expanded?'Exit full screen':'Full screen';if(viewer.open)fit();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelDrag();compare(false);stop();}else schedule();});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();disable();renderer=null;status('Graphics paused. Your original photo is still available. Try turning motion on again.');});
reduced.addEventListener('change',()=>{if(reduced.matches)setMode('drag');});
new ResizeObserver(()=>{cancelDrag();fit();}).observe($('stage'));
document.addEventListener('keydown',event=>{
  if(!viewer.open||['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return;
  if(event.key==='ArrowRight'){event.preventDefault();select(index+1);}
  if(event.key==='ArrowLeft'){event.preventDefault();select(index-1);}
});
fetch(`./assets/manifest.json${new URL(import.meta.url).search}`).then(response=>{if(!response.ok)throw new Error('Samples unavailable.');return response.json();}).then(async manifest=>{
  // Never advertise a protected sample before its depth upload is verified.
  // Local review can exercise the prepared derivatives before publication.
  const localReview=['localhost','127.0.0.1'].includes(location.hostname);
  samples=manifest.samples.filter(sample=>!sample.protected||sample.assetStatus==='published'||localReview);
  let hasPrivate=samples.some(sample=>sample.protected),authUnavailable=false;
  if(hasPrivate)try{await loadAuth();}catch{samples=samples.filter(sample=>!sample.protected);hasPrivate=false;authUnavailable=true;}
  $('intro-note').textContent=authUnavailable?'Trip photo access could not load. The public examples are available; reload to retry.':hasPrivate?'Always still until you turn it on. Trip photos use your usual atlas password.':'Always still until you turn it on.';
  $('private-preview-note').hidden=!hasPrivate;
  samples.forEach((sample,i)=>{
    const button=document.createElement('button');button.type='button';button.className='sample';button.setAttribute('aria-label',`Open sample photo ${i+1} in fullscreen`);
    const thumb=document.createElement('img');thumb.alt=sample.alt||'';thumb.loading='lazy';
    if(sample.protected){thumb.dataset.privateSrc=sample.thumbnail;button.dataset.protected='true';}
    else thumb.src=asset(sample.image);
    const label=document.createElement('span');label.textContent=`Open photo ${i+1} ↗`;button.append(thumb,label);button.onclick=()=>open(i,button);$('samples').append(button);
    const tile=document.createElement('button');tile.type='button';tile.setAttribute('aria-label',`Sample photo ${i+1}`);tile.setAttribute('aria-pressed','false');tile.append(thumb.cloneNode());tile.onclick=()=>select(i);if(sample.protected)tile.dataset.protected='true';$('filmstrip').append(tile);
  });
  auth?.prepare($('intro'));auth?.prepare($('filmstrip'));syncPrivateThumbnails();
  // Restore an explicit selected photo after the normal private login redirect.
  const requested=Number(location.hash.match(/^#photo-(\d+)$/)?.[1])-1;
  if(Number.isInteger(requested)&&requested>=0&&requested<samples.length){
    // A direct link or login return needs its own gallery underneath the viewer.
    // Reloading a viewer opened here already has that local history entry.
    if(!history.state?.fromIntro){
      history.replaceState(null,'',location.pathname+location.search);
      history.pushState({depthDemo:true,fromIntro:true,photo:requested},'',`#photo-${requested+1}`);
    }
    opener=$('samples').children[requested];viewer.showModal();select(requested);$('back').focus();
  }
}).catch(()=>{$('samples').textContent='The sample photos could not load. Please reload to try again.';});
