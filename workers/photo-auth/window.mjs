import { derivePasswordProofs } from './password-kdf.mjs';
export function loginWindow(nonce, parameters) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Journey Atlas</title><style nonce="${nonce}">
:root{font-family:system-ui,sans-serif;color:#283f40;background:#f5f1e7;color-scheme:light}body{margin:0;min-height:100svh;display:grid;place-items:center}main{max-width:360px;padding:32px}small{letter-spacing:.12em}h1{font:38px Georgia,serif;margin:18px 0}p{line-height:1.6}label{display:block;margin-top:24px}input,button{box-sizing:border-box;width:100%;font:inherit;padding:14px;border:1px solid #728b86;border-radius:8px;margin-top:8px}button{background:#235c56;color:white;cursor:pointer}button:disabled{opacity:.6;cursor:wait}input{background:white}#message{min-height:3em}a{color:#235c56}:focus-visible{outline:3px solid #ba641e;outline-offset:3px}[hidden]{display:none!important}</style></head><body><main hidden><small>JOURNEY ATLAS</small><h1 id="heading">Checking photo access</h1><p id="intro" hidden>Enter a shared password to view the trip photos. This browser will remember access for 30 days.</p><form id="login" hidden><label for="password">Photo password</label><input id="password" type="password" autocomplete="current-password" required maxlength="512"><button id="submit">Unlock photos</button></form><p id="message" role="status" aria-live="polite">Restoring photo access…</p><button id="retry-session" hidden>Try restoring again</button><button id="done">Return to the atlas</button></main><noscript>Enable JavaScript to check photo access, or use Back to return to the atlas.</noscript><script nonce="${nonce}">
const derivePasswordProofs=${derivePasswordProofs.toString()};
const passwordParameters=${JSON.stringify(parameters).replaceAll('<', '\\u003c')};
const params=new URL(location.href).searchParams, origin=params.get('origin'),state=params.get('state'),logout=params.get('action')==='logout',restore=params.get('action')==='restore';
const returnTo=params.get('returnTo'),challenge=params.get('challenge');
let leaving=false,activeController,revealTimer;
const main=document.querySelector('main'),heading=document.querySelector('#heading');
const reveal=()=>{clearTimeout(revealTimer);if(!leaving)main.hidden=false;};
const leave=()=>{leaving=true;clearTimeout(revealTimer);main.hidden=true;};
const retry=document.querySelector('#retry-session');
const message=document.querySelector('#message'),form=document.querySelector('#login'),input=document.querySelector('#password'),button=document.querySelector('#submit'),done=document.querySelector('#done');
const send=payload=>{if(leaving)return;leave();const target=new URL(returnTo);target.hash=new URLSearchParams({state,...(payload.loggedOut?{photoAuthLogout:'1'}:payload.missing?{photoAuthMissing:'1'}:{photoAuthCode:payload.code})}).toString();location.replace(target.href);};
done.onclick=()=>{leave();activeController?.abort();const target=new URL(returnTo);target.hash=new URLSearchParams({state,photoAuthCancel:'1'}).toString();location.replace(target.href);};
async function request(endpoint,body){
  const controller=new AbortController();activeController=controller;let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Photo access is taking too long. Please try again.'));},15000);});
  try{return await Promise.race([(async()=>{
    const response=await fetch('/private-photos/auth/'+endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({origin,challenge,...body}),signal:controller.signal});
    const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'Unable to unlock photos. Please try again.'),{status:response.status});return data;
  })(),timeout]);}finally{clearTimeout(timer);if(activeController===controller)activeController=null;}
}
async function start(){
  clearTimeout(revealTimer);
  retry.hidden=true;form.hidden=true;document.querySelector('#intro').hidden=true;
  heading.textContent=logout?'Locking photos':'Checking photo access';
  message.textContent=logout?'Locking photos…':'Restoring photo access…';
  // Fast automatic checks never paint login chrome. Slow checks remain cancellable.
  revealTimer=setTimeout(reveal,500);
  try{if(logout){await request('logout',{});send({loggedOut:true});return;}send(await request('session',{}));}
  catch(error){
    if(leaving)return;
    if(restore&&error.status===401){send({missing:true});return;}
    if(error.status!==401){message.textContent=error.message;retry.hidden=false;}
    else message.textContent='';
    reveal();
    // Automatic recovery errors must not turn into an unsolicited password form.
    if(!logout&&!restore){heading.textContent='Private photographs';document.querySelector('#intro').hidden=false;form.hidden=false;input.focus();}
  }
}
retry.onclick=start;
form.onsubmit=async event=>{event.preventDefault();button.disabled=true;message.textContent='Unlocking…';const password=input.value;input.value='';try{const proofs=await derivePasswordProofs(password,passwordParameters);send(await request('login',{proofs}));form.hidden=true;}catch(error){if(!leaving){message.textContent=error.message;input.focus();}}finally{button.disabled=false;}};
done.hidden=false;done.textContent='Continue without photos';start();
</script></body></html>`;
}
