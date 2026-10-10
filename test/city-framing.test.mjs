import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/atlas-utils.js';
const {cityFrameCoordinates,validCityBoundary}=globalThis.JOURNEY_ATLAS_UTILS;
const ring=(x,y,size)=>[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]];
const photo=(lng,lat,extra={})=>({lng,lat,...extra});

test('city framing includes city limits plus five miles, excluding distant travel photos',()=>{
  const boundary={type:'Polygon',coordinates:[ring(0,0,1)]};
  const photos=[photo(.9,.9),photo(1.06,.5),photo(1.08,.5),photo(3,3),photo(.01,.01,{trashed:true}),photo(.02,.02,{hidden:true}),photo(.03,.03,{mediaType:'video'}),{}];
  assert.deepEqual(cityFrameCoordinates({center:[0,0],boundary,photos}),[[0,0],[.9,.9],[1.06,.5]]);
});

test('all marked places for the stop count, and missing boundaries use five miles from the destination',()=>{
  const fiveMilesDegrees=8.04672/6371*180/Math.PI;
  const photos=[photo(fiveMilesDegrees*.999,0),photo(fiveMilesDegrees*1.001,0),photo(0,91)];
  const places=[{coordinates:[2,2],dayIds:['city']},{coordinates:[.03,.03],dayIds:[]},{coordinates:[3,3],dayIds:['other']},{coordinates:[181,0],dayIds:['city']}];
  assert.deepEqual(cityFrameCoordinates({center:[0,0],photos,places,dayId:'city'}),[[0,0],[fiveMilesDegrees*.999,0],[2,2],[.03,.03]]);
  assert.deepEqual(cityFrameCoordinates({center:null,photos,places,dayId:'city'}),[[2,2]]);
  assert.deepEqual(cityFrameCoordinates({center:null}),[]);
});

test('city boundaries handle holes, detached districts and dateline coordinates',()=>{
  const boundary={type:'MultiPolygon',coordinates:[[ring(0,0,1),ring(.2,.2,.6)],[ring(2,2,.2)]]};
  assert.equal(validCityBoundary(boundary),true);
  assert.deepEqual(cityFrameCoordinates({boundary,photos:[photo(.5,.5),photo(2.1,2.1),photo(.21,.5)]}),[[2.1,2.1],[.21,.5]]);
  const dateline={type:'Polygon',coordinates:[[[179.7,0],[-179.7,0],[-179.7,1],[179.7,1],[179.7,0]]]};
  assert.deepEqual(cityFrameCoordinates({boundary:dateline,photos:[photo(-179.9,.5),photo(0,.5)]}),[[-179.9,.5]]);
});

test('invalid boundary geometry falls back safely without widening to remote photos',()=>{
  for(const boundary of [null,{}, {type:'MultiPolygon'}, {type:'Polygon',coordinates:[]}, {type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[2,2]]]}, {type:'Polygon',coordinates:[ring(181,0,1)]}]){
    assert.equal(validCityBoundary(boundary),false);
    assert.deepEqual(cityFrameCoordinates({center:[0,0],boundary,photos:[photo(8,8)]}),[[0,0]]);
  }
});
