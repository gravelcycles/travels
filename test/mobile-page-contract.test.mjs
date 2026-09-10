import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {renderJourneyPage} from '../scripts/build-site.mjs';
import {loadContent} from '../scripts/journey-content.mjs';
import {createJourney} from '../scripts/create-journey.mjs';
const repo=path.resolve(import.meta.dirname,'..');
const controls=['mobile-open-replay','mobile-day-details','mobile-day-photos','mobile-day-picker','story-map-preview','mobile-photo-location','mobile-photo-grid','mobile-journey-actions','mobile-story-legend','photo-location-panel'];
test('mobile controls and assets are shared by the real trip, demos and a newly created empty draft',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-mobile-contract-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.cpSync(path.join(repo,'content'),path.join(root,'content'),{recursive:true});
  const draft=createJourney(root,{title:'Empty mobile trip',slug:'mobile-test',startDate:'2028-03-01',endDate:'2028-03-03',timeZone:'Europe/Berlin'});
  const {data}=loadContent(root,{includeDrafts:true});
  assert.ok(data.journeys.some(j=>j.id===draft.id));
  for(const journey of data.journeys){
    const html=renderJourneyPage(root,journey,{preview:true});
    for(const id of controls)assert.equal(html.split(`id="${id}"`).length-1,1,`${journey.id}: ${id}`);
    assert.match(html,/assets\/mobile-ux\.js/);assert.match(html,/assets\/mobile\.css/);
  }
  const demo=fs.readFileSync(path.join(repo,'dist/demo.html'),'utf8');
  for(const id of controls)assert.equal(demo.split(`id="${id}"`).length-1,1,`public demo: ${id}`);
});
