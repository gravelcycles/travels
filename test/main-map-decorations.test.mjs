import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {photoBubbleFixture} from './photo-bubble-harness.mjs';
import {viewerFunction} from './viewer-flow-harness.mjs';

test('resuming the shared map coalesces deferred bubble resize and label layout into one pass',()=>{
  const f=photoBubbleFixture({ready:true});
  let labelLayouts=0;
  f.context.clearTimeout=clearTimeout;
  vm.runInContext(fs.readFileSync(new URL('../dist/assets/location-labels.js',import.meta.url),'utf8'),f.context);
  const labels=f.context.window.JOURNEY_ATLAS_LOCATION_LABELS.create({
    map:f.map,maplibregl:f.context.window.maplibregl,onSelectDay(){},
    obstacles(){labelLayouts++;return [];}
  });
  f.context.locationLabels=labels;f.context.photoBubbles=f.controller;
  f.context.photoDialog={open:false};f.context.mainMapCovered=false;
  vm.runInContext(viewerFunction('setMainMapCovered'),f.context);
  f.controller.mapReady();labels.update([],[]);f.flush();
  const before={...f.work}, initialLayouts=labelLayouts;
  f.context.setMainMapCovered(true);
  for(let i=0;i<4;i++){labels.update([],[]);f.resize(false);}
  f.flush();
  assert.deepEqual(f.work,before);assert.equal(labelLayouts,initialLayouts);
  f.context.setMainMapCovered(false);f.flush();
  assert.equal(f.work.resizes,before.resizes+1,'All covered resize requests share one map resize');
  assert.equal(labelLayouts,initialLayouts+1,'The resize event joins the already queued label refresh');
  assert.equal(f.pendingFrames,0);
});
