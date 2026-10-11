import fs from 'node:fs';
import vm from 'node:vm';
import '../dist/assets/arrival-chapter.js';
const source=fs.readFileSync(new URL('../dist/assets/app.js',import.meta.url),'utf8');
function fn(name){const start=source.indexOf(`  function ${name}(`);return source.slice(start,source.indexOf('\n  function ',start+1));}

export function arrivalCameraHarness(legs,{width=600,height=540,phone=false}={}){
  const markers=[],calls=[],listeners=new Map(),rect={top:100,bottom:height+100,width,height};
  const boundsCamera={center:[11,46],zoom:7,bearing:0};
  let moving=false,eventData;
  const map={
    resize:()=>calls.push({type:'resize'}),getCenter:()=>({toArray:()=>[11,47]}),getZoom:()=>12.5,
    cameraForBounds:(bounds,options)=>{calls.push({type:'fit',bounds,options});return boundsCamera;},
    easeTo:(camera,event)=>{calls.push({type:'ease',camera});moving=true;eventData=event;},
    flyTo:()=>{throw Error('Arrival should not use a flight arc');},
    stop(){moving=false;},isMoving:()=>moving,
    on:(name,listener)=>listeners.set(name,listener),off:name=>listeners.delete(name),getLayer:()=>false
  };
  class Marker {constructor(options){markers.push(options);} setLngLat(){return this;} addTo(){return this;} remove(){} }
  const day={id:'day',title:'Destination'},context=vm.createContext({
    mainMap:map,mainMapReady:true,mapScope:'day',mainFeedback:null,
    drawMainMap:()=>calls.push({type:'draw'}),
    arrivalPlan:globalThis.JOURNEY_ATLAS_ARRIVAL.plan(legs,s=>s.geometry),arrivalPlaceMarkers:[],
    cityCoordinate:()=>[11,47],placeById:()=>null,boundsFromCoordinates:points=>points,
    window:{JOURNEY_ATLAS_ARRIVAL:globalThis.JOURNEY_ATLAS_ARRIVAL},maplibregl:{Marker},
    document:{createElement:()=>({append(){}})},
    $:selector=>({getBoundingClientRect:()=>selector==='#map'?rect:{top:phone?rect.bottom:rect.bottom-90,bottom:rect.bottom+(phone?100:-18)}}),
    mapPadding:()=>({top:40,bottom:112,left:40,right:40}),cityCamera:()=>boundsCamera,
    segmentsForDay:()=>legs,prefersReducedMotion:()=>false,renderDayNavigator(){},renderArrivalChapter(){},day
  });
  vm.runInContext(fn('prepareArrivalView')+'\n'+fn('showCity'),context);
  return {context,calls,markers,rect,boundsCamera,prepare(ready=()=>{}){context.ready=ready;return vm.runInContext('prepareArrivalView(day,day,ready)',context);},finish(){moving=false;listeners.get('moveend')?.(eventData);},city(){vm.runInContext('showCity(day)',context);}};
}

export function arrivalLayerHarness() {
  const layers=new Map(),decorations={layerIds:[]};let drawing=false;
  const map={getLayer:id=>layers.get(id),setLayoutProperty(id,name,value){assertLayer(id);layers.get(id)[name]=value;}};
  function assertLayer(id){if(!layers.has(id))throw Error(`Cannot style missing layer ${id}`);}
  const context=vm.createContext({mainMap:map,mainMapReady:true,arrivalDrawing:null,
    arrivalPlan:{legs:[{segment:{id:'rail',mode:'train'}}]},mainDecorations:decorations,
    arrivalKey:()=> 'selected',activeDay:()=>({}),arrivalPlaceMarkers:[],prefersReducedMotion:()=>false,
    window:{JOURNEY_ATLAS_ARRIVAL:{createDrawing:()=>{drawing=true;return {destroy(){}};}}},
    modeStyles:{train:{width:6}},palette:{muted:'#888'},
    addSegmentLayer(map,decorations,segment,{prefix}){for(const part of ['line','casing'])layers.set(`${prefix}-${part}-${segment.id}`,{});}
  });
  vm.runInContext(fn('drawArrival')+'\n'+fn('syncArrivalLayers'),context);
  return {layers,start(){vm.runInContext("drawArrival({key:'selected'})",context);},redraw(){layers.clear();for(const part of ['line','casing'])layers.set(`main-${part}-rail`,{});vm.runInContext('syncArrivalLayers()',context);},get drawing(){return drawing;}};
}
