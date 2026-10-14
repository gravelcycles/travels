const $=id=>document.getElementById(id);
const viewer=$('viewer'),still=$('still'),frame=$('image-frame'),canvas=$('depth-canvas');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let samples=[],index=0,enabled=false,loading=false,paused=false,comparing=false,mode='drag';
let renderer=null,epoch=0,raf=0,last=0,elapsed=0,amount=0,x=0,y=0,targetX=0,targetY=0,ready=false,opener=null;
let drag=null;
const clamp=(value,limit)=>Math.max(-limit,Math.min(limit,value));
const level=()=>Number($('strength').value)/100;
const cache=new Map();
const image=(url,errorMessage='This photo could not load. Please try again.')=>{
  if(cache.has(url))return cache.get(url);
  const promise=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error(errorMessage));img.src=url;});
  cache.set(url,promise);promise.catch(()=>cache.delete(url));return promise;
};
const asset=file=>new URL(`./assets/${file}`,import.meta.url).href;
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
  $('drift-mode').setAttribute('aria-pressed',String(mode==='drift'));
  $('drag-mode').setAttribute('aria-pressed',String(mode==='drag'));
  $('pause').hidden=mode!=='drift';$('reset-view').hidden=mode==='drift';
  $('pause').textContent=paused?'Resume':'Pause';$('pause').setAttribute('aria-pressed',String(paused));
  $('stage-badge').textContent=comparing||!enabled?'Original':loading?'Preparing depth':level()===0?'Flat · 0×':drag?'Drag to explore':paused?'Depth · paused':mode==='drag'?'Drag to explore':'Depth motion';
  $('previous').disabled=index===0;$('next').disabled=index===samples.length-1;
}
function modeStatus(){status(mode==='drift'?'A slow drift. Drag the photo to take control.':'Drag to look around; release to hold. Arrow keys move the focused photo; Home resets.');}
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
    if(mode==='drift'){targetX=Math.sin(elapsed*.34)*.03;targetY=Math.sin(elapsed*.26)*.02;}
    const ease=drag||reduced.matches?1:1-Math.exp(-dt*12);x+=(targetX-x)*ease;y+=(targetY-y)*ease;
  }
  amount=reduced.matches?1:Math.min(1,amount+dt*2.5);
  renderer.draw(x,y,amount,level());frame.classList.add('is-active');
  // No animation loop for flat, paused or settled drag views, hidden tabs or stills.
  if(amount<1||(level()>0&&!paused&&(mode==='drift'||Math.abs(targetX-x)+Math.abs(targetY-y)>.00001)))schedule();else last=0;
}
async function select(next){
  if(next<0||next>=samples.length)return;
  disable();index=next;const token=++epoch;ready=false;sync();
  if(history.state?.depthDemo)history.replaceState({...history.state,photo:index},'',`#photo-${index+1}`);
  $('photo-count').textContent=`${index+1} / ${samples.length}`;
  [...$('filmstrip').children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
  status('Loading photograph…');
  const sample=samples[index];
  try{
    const loaded=await image(asset(sample.image));if(token!==epoch)return;
    still.src=loaded.src;still.alt=sample.alt||'Public sample photograph';ready=true;
    $('credit').replaceChildren();
    const link=document.createElement('a');link.href=sample.sourceUrl;link.target='_blank';link.rel='noopener';link.textContent=sample.credit;
    const license=document.createElement('a');license.href=sample.licenseUrl;license.target='_blank';license.rel='noopener';license.textContent=sample.license;
    $('credit').append(link,' · ',license);
    fit();sync();status('The original photograph.');
  }catch(error){if(token===epoch){still.removeAttribute('src');status(error.message);}}
}
function open(next,button){opener=button;history.pushState({depthDemo:true,photo:next},'',`#photo-${next+1}`);viewer.showModal();select(next);$('back').focus();}
function close(){disable();viewer.close();if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});opener?.focus();}
function back(){if(history.state?.depthDemo)history.back();else close();}
function compare(on){if(on)cancelDrag();comparing=on&&enabled&&!loading;frame.classList.toggle('is-comparing',comparing);sync();if(comparing)stop();else schedule();}
function setMode(next){cancelDrag();mode=next;paused=false;targetX=x;targetY=y;sync();if(enabled){modeStatus();schedule();}}
function resetView(){setMode('drag');targetX=0;targetY=0;schedule();}
$('depth-toggle').onclick=()=>enabled?disable():enable();
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
$('drift-mode').onclick=()=>setMode('drift');$('drag-mode').onclick=()=>setMode('drag');
$('reset-view').onclick=resetView;
$('pause').onclick=()=>{paused=!paused;sync();schedule();};
function updateDepth(){
  const value=Number($('strength').value),description=value===0?'Flat · 0×':`${(value/100).toFixed(2).replace(/0$/,'')}×`;
  $('strength-value').textContent=description;$('strength').setAttribute('aria-valuetext',value===0?'Flat, no depth':`${value/100} times depth`);
  $('depth-note').hidden=value<200;
  document.querySelectorAll('[data-depth]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.depth)===value)));
  sync();schedule();
}
$('strength').oninput=updateDepth;
document.querySelectorAll('[data-depth]').forEach(button=>{button.onclick=()=>{$('strength').value=button.dataset.depth;updateDepth();};});
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
  if(!drag||event.pointerId!==drag.id||!enabled||loading)return;
  targetX=clamp(drag.x+(event.clientX-drag.startX)/drag.width*.16,.04);
  targetY=clamp(drag.y-(event.clientY-drag.startY)/drag.height*.16,.03);schedule();
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])frame.addEventListener(event,input=>{
  if(!drag||input.pointerId!==drag.id)return;
  cancelDrag();sync();schedule();
});
frame.addEventListener('keydown',event=>{
  if(!enabled||loading||comparing||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();
  if(event.key==='Home'){resetView();return;}
  if(mode!=='drag')setMode('drag');else cancelDrag();
  const step=event.shiftKey ? .016 : .006;
  if(event.key==='ArrowLeft')targetX=clamp(targetX-step,.04);
  if(event.key==='ArrowRight')targetX=clamp(targetX+step,.04);
  if(event.key==='ArrowUp')targetY=clamp(targetY+step,.03);
  if(event.key==='ArrowDown')targetY=clamp(targetY-step,.03);
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
fetch('./assets/manifest.json').then(response=>{if(!response.ok)throw new Error('Samples unavailable.');return response.json();}).then(manifest=>{
  samples=manifest.samples;
  samples.forEach((sample,i)=>{
    const button=document.createElement('button');button.type='button';button.className='sample';button.setAttribute('aria-label',`Open sample photo ${i+1} in fullscreen`);
    const thumb=document.createElement('img');thumb.src=asset(sample.image);thumb.alt=sample.alt||'';thumb.loading='lazy';
    const label=document.createElement('span');label.textContent=`Open photo ${i+1} ↗`;button.append(thumb,label);button.onclick=()=>open(i,button);$('samples').append(button);
    const tile=document.createElement('button');tile.type='button';tile.setAttribute('aria-label',`Sample photo ${i+1}`);tile.setAttribute('aria-pressed','false');tile.append(thumb.cloneNode());tile.onclick=()=>select(i);$('filmstrip').append(tile);
  });
  // Deep links still require a deliberate open gesture and never enable motion.
}).catch(()=>{$('samples').textContent='The sample photos could not load. Please reload to try again.';});
