const $=id=>document.getElementById(id);
const viewer=$('viewer'),still=$('still'),frame=$('image-frame'),canvas=$('depth-canvas');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let samples=[],index=0,enabled=false,loading=false,paused=false,comparing=false,mode=reduced.matches?'pointer':'drift';
let renderer=null,epoch=0,raf=0,last=0,elapsed=0,amount=0,x=0,y=0,targetX=0,targetY=0,ready=false,opener=null;
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
  frame.classList.toggle('is-interactive',enabled&&!loading&&mode==='pointer');
  $('depth-toggle').setAttribute('aria-checked',String(enabled));
  $('toggle-label').textContent=loading?'Preparing…':enabled?'On':'Off';
  $('motion-controls').disabled=!enabled||loading;
  $('depth-toggle').disabled=!ready;
  $('drift-mode').setAttribute('aria-pressed',String(mode==='drift'));
  $('pointer-mode').setAttribute('aria-pressed',String(mode==='pointer'));
  $('pause').textContent=paused?'Resume':'Pause';$('pause').setAttribute('aria-pressed',String(paused));
  $('stage-badge').textContent=comparing||!enabled?'Original':loading?'Preparing depth':paused?'Depth · paused':'Depth motion';
  $('previous').disabled=index===0;$('next').disabled=index===samples.length-1;
}
function modeStatus(){status(mode==='drift'?'A slow, continuous change of perspective.':'Move your pointer, or drag gently across the photo.');}
function stop(){cancelAnimationFrame(raf);raf=0;last=0;}
function disable(){
  epoch++;enabled=false;loading=false;paused=false;comparing=false;amount=0;x=0;y=0;targetX=0;targetY=0;elapsed=0;
  stop();frame.classList.remove('is-active','is-comparing');status('The original photograph.');sync();
}
async function enable(){
  const token=++epoch;enabled=true;loading=true;paused=false;sync();status('Preparing depth motion…');
  try{
    const [{DepthRenderer},depth]=await Promise.all([import('./renderer.js'),image(asset(samples[index].depth),'Depth motion could not load. The original photo is still available. Try again.')]);
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
    const strength=Number($('strength').value)/100;
    if(mode==='drift'){targetX=Math.sin(elapsed*.34)*.052*strength;targetY=Math.sin(elapsed*.26)*.026*strength;}
    const ease=1-Math.exp(-dt*7);x+=(targetX-x)*ease;y+=(targetY-y)*ease;
  }
  amount=reduced.matches?1:Math.min(1,amount+dt*2.5);
  renderer.draw(x,y,amount);frame.classList.add('is-active');
  // No animation loop for paused/settled pointer mode, hidden tabs, or stills.
  if(amount<1||(!paused&&(mode==='drift'||Math.abs(targetX-x)+Math.abs(targetY-y)>.00001)))schedule();else last=0;
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
function compare(on){comparing=on&&enabled&&!loading;frame.classList.toggle('is-comparing',comparing);sync();if(comparing)stop();else schedule();}
function setMode(next){mode=next;targetX=0;targetY=0;sync();if(enabled){modeStatus();schedule();}}
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
$('drift-mode').onclick=()=>setMode('drift');$('pointer-mode').onclick=()=>setMode('pointer');
$('pause').onclick=()=>{paused=!paused;sync();schedule();};
$('strength').oninput=()=>{const value=Number($('strength').value);$('strength-value').textContent=value<60?'Gentle':value<85?'Medium':'Strong';schedule();};
const compareButton=$('compare');
compareButton.addEventListener('pointerdown',event=>{compareButton.setPointerCapture(event.pointerId);compare(true);});
for(const event of ['pointerup','pointercancel','lostpointercapture','blur'])compareButton.addEventListener(event,()=>compare(false));
compareButton.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();compare(true);}});
compareButton.addEventListener('keyup',()=>compare(false));
frame.addEventListener('pointermove',event=>{
  if(mode!=='pointer'||!enabled||loading||paused||(event.pointerType==='touch'&&!event.buttons))return;
  const rect=frame.getBoundingClientRect(),strength=Number($('strength').value)/100;
  targetX=((event.clientX-rect.left)/rect.width-.5)*.104*strength;targetY=-((event.clientY-rect.top)/rect.height-.5)*.052*strength;schedule();
});
frame.addEventListener('pointerleave',()=>{targetX=0;targetY=0;schedule();});
frame.addEventListener('pointerdown',event=>{if(mode==='pointer'&&enabled)frame.setPointerCapture(event.pointerId);});
for(const event of ['pointerup','pointercancel'])frame.addEventListener(event,()=>{targetX=0;targetY=0;schedule();});
$('expand').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else status('This photo already fills your browser. Device fullscreen is not supported here.');}catch{status('This photo already fills your browser. Device fullscreen is unavailable.');}};
document.addEventListener('fullscreenchange',()=>{const expanded=Boolean(document.fullscreenElement);$('expand').setAttribute('aria-label',expanded?'Exit device fullscreen':'Use device fullscreen');$('expand').querySelector('span').textContent=expanded?'Exit full screen':'Full screen';if(viewer.open)fit();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){compare(false);stop();}else schedule();});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();disable();renderer=null;status('Graphics paused. Your original photo is still available. Try turning motion on again.');});
reduced.addEventListener('change',()=>{if(reduced.matches){setMode('pointer');targetX=0;targetY=0;}});
new ResizeObserver(fit).observe($('stage'));
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
