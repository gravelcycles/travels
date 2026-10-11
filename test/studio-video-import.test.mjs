import test from 'node:test';
import assert from 'node:assert/strict';
import '../studio/video-import.js';
const {transfer} = globalThis.JOURNEY_ATLAS_VIDEO_IMPORT;
function fixture() {
  const events = {}, upload = {}, states=[];
  const request = {status:201,responseText:JSON.stringify({ok:true,video:{id:'synthetic'}}),
    upload:{addEventListener:(name,fn)=>upload[name]=fn}, addEventListener:(name,fn)=>events[name]=fn,
    open(method,url){this.method=method;this.url=url;},setRequestHeader(){},send(file){this.file=file;},abort(){events.abort();}};
  const file={name:'synthetic.mov',size:400};
  const operation=transfer({url:'/api/videos/import?journeyId=fixture',file,onProgress:state=>states.push(state),createRequest:()=>request});
  return {request,events,upload,states,operation,file};
}
test('video transfer reports measured progress, then indeterminate preparation and ready only after success', async () => {
  const f=fixture();assert.equal(f.request.file,f.file);
  f.upload.progress({lengthComputable:true,loaded:200,total:400});assert.deepEqual(f.states.at(-1),{stage:'transferring',percent:50,cancellable:true});
  f.upload.load();assert.deepEqual(f.states.at(-1),{stage:'preparing',percent:null,cancellable:false});assert.equal(f.operation.cancel(),false);
  f.events.load();assert.equal((await f.operation.promise).video.id,'synthetic');assert.equal(f.states.at(-1).stage,'ready');
});
test('cancelling transfer and interruption both settle once and allow an explicit retry with the same file', async () => {
  const f=fixture();assert.equal(f.operation.cancel(),true);await assert.rejects(f.operation.promise,/cancelled/);
  f.events.load();assert.equal(f.states.at(-1).stage,'cancelled');assert.equal(f.operation.cancel(),false);
  const retry=fixture();retry.upload.load();retry.events.error();await assert.rejects(retry.operation.promise,/retry finds the existing clip/);assert.equal(retry.request.file,retry.file);
});
test('failed preparation never claims ready, and unknown transfer size remains indeterminate', async () => {
  const f=fixture();f.upload.progress({lengthComputable:false});assert.equal(f.states.at(-1).percent,null);
  f.upload.load();f.request.status=400;f.request.responseText=JSON.stringify({ok:false,error:'Invalid video'});f.events.load();
  await assert.rejects(f.operation.promise,/Invalid video/);assert.equal(f.states.some(s=>s.stage==='ready'),false);
});
