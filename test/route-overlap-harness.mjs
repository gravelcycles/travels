import vm from 'node:vm';
import {viewerFunction} from './viewer-flow-harness.mjs';
import {mapStyleHarness} from './map-style-harness.mjs';
import '../dist/assets/map-style.js';

export function routeOverlapHarness(journey, routes = {}, dayId = null) {
  const map = mapStyleHarness(), sources = new Map();
  map.addSource = (id, source) => sources.set(id, source);
  map.getSource = id => sources.get(id);
  map.removeLayer = id => { throw Error(`Unexpected redraw removal: ${id}`); };
  map.removeSource = id => sources.delete(id);
  const context = vm.createContext({journey, mainMap:map, mainMapReady:true, mapScope:dayId?'day':'journey',
    activeDayId:dayId||journey.days[0].id, inspectedSegmentId:null,
    mainDecorations:{markers:[],layerIds:[],sourceIds:[],hitLayerIds:[],routeLayers:[]},
    window:{JOURNEY_ATLAS_MAP_STYLE:globalThis.JOURNEY_ATLAS_MAP_STYLE},
    palette:{route:'#006f92',casing:'#fffef8',muted:'#71878a'},
    modeStyles:{train:{color:'#0072b2',width:5.8},bus:{color:'#a85c00',width:5,dash:[5.5,2.2]}},
    segmentCoordinates:segment=>segment.geometry || routes[segment.id] || [[1,1],[2,2]],
    activeDay:()=>journey.days.find(day=>day.id===context.activeDayId),
    mapIsReady:()=>true, renderPlanningFilters(){}, photoBubbles:null, renderLegend(){},
    clearDayPreview(){},syncArrivalLayers(){},openingRoute:null,addDayStopMarkers:()=>[],renderDayNavigator(){},locationLabels:null
  });
  vm.runInContext(['clearDecorations','addSegmentLayer','drawMainMap'].map(viewerFunction).join('\n'),context);
  context.drawMainMap(false);
  return {context,map,sources,layers:()=>map.getStyle().layers};
}
