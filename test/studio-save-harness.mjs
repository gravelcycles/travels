import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {prepareJourneyPlan} from '../scripts/journey-planner.mjs';
const repo=path.resolve(import.meta.dirname,'..');
// Exercise the real save/preview functions with the real planner validator.
// Rendering is stubbed here; the endpoint and page are also checked in the UI.
export function studioSaveHarness(data, journey, initialState) {
  const nodes=new Map(), requests=[],plans=new Map();let savedJourney=null;
  const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,inert:false,textContent:'',className:''});return nodes.get(id);};
  const plan={draft:structuredClone(journey),dirty:true,revision:'revision',alignment:'dates',version:1};plans.set(journey.id,plan);
  const source=fs.readFileSync(path.join(repo,'studio/studio.js'),'utf8');
  const start=source.indexOf('  async function previewPlan()'), end=source.indexOf("  $('#trip-planner').addEventListener('input'",start);
  const fields=['title','subtitle','startDate','endDate','timeZone','places','segments','days','coverPhoto','replayMoments'];
  const context=vm.createContext({$,structuredClone,journey:structuredClone(journey),state:structuredClone(initialState),plans,savingState:false,savedStateRevision:'state-revision',savedRevisions:{},draftRecovery:null,photosByJourney:{},basePhotos:[],dirty:true,
    planForJourney:()=>plan,planChanges:draft=>Object.fromEntries(fields.filter(key=>draft[key]!==undefined).map(key=>[key,draft[key]])),
    persistDraft(){},setStatus:(text,type)=>{$('#save-status').textContent=text;$('#save-status').className=type;},markSaved:()=>context.dirty=false,markDirty:()=>context.dirty=true,
    renderJourneySelector(){},renderDaySelectors(){},renderDayList(){},renderRouteList(){},renderPhotoGrid(){},renderPlanner(){},
    fetch:async(_url,options)=>{const input=JSON.parse(options.body);requests.push(input);try {
      const result=prepareJourneyPlan(data,journey,input.changes,input.state,input.alignment);
      if(!input.preview)savedJourney=result.journey;
      return {ok:true,json:async()=>({ok:true,...result,revision:'new-revision',stateRevision:'new-state-revision'})};
    }catch(error){return {ok:false,json:async()=>({ok:false,error:error.message})};}}
  });
  vm.runInContext(source.slice(start,end),context);
  return {context,plan,$,requests,saved:()=>savedJourney};
}
