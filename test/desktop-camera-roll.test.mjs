import test from 'node:test';
import assert from 'node:assert/strict';
import {photoEntryFixture} from './viewer-flow-harness.mjs';

const journey={id:'desktop-roll',title:'Independent trip',eventMode:'city',days:[
 {id:'harbor',number:1,title:'Harbor',photoOrder:['a2','a1']},
 {id:'empty',number:2,title:'Empty'}, {id:'hill',number:3,title:'Hill'}],
 photos:[{id:'a1',dayId:'harbor'},{id:'b1',dayId:'hill'},{id:'a2',dayId:'harbor'},{id:'clip',dayId:'hill',mediaType:'video'}]};

test('desktop reel selection and fullscreen allow the rest of the city and the full trip',()=>{
 const f=photoEntryFixture(journey);f.click('photoStrip','a1');
 assert.equal(f.context.photoDialog.open,false);
 assert.equal(f.events.at(-1).options.browseJourney,true);
 assert.deepEqual(Array.from(f.events.at(-1).photos),['a2','a1','b1']);
 f.open('a1');assert.equal(f.context.viewerPhotoIndex,1);
 f.context.moveViewer(1);assert.equal(f.photos()[f.context.viewerPhotoIndex].id,'b1');
 f.context.moveViewer(1);assert.equal(f.photos()[f.context.viewerPhotoIndex].id,'clip');
 f.context.moveViewer(1);assert.equal(f.context.viewerPhotoIndex,3);
 f.context.moveViewerDay(-1);assert.equal(f.photos()[f.context.viewerPhotoIndex].id,'a2');
 f.context.moveViewerDay(1);assert.equal(f.photos()[f.context.viewerPhotoIndex].id,'b1');
 f.context.openDayViewer('hill');assert.equal(f.context.viewerPhotoIndex,2);
});

test('empty desktop event stays empty and can jump to the next populated event',()=>{
 const f=photoEntryFixture(journey);f.context.openDayViewer('empty');
 assert.deepEqual(f.photos(),[]);assert.equal(f.context.viewerDayId,'empty');
 f.context.moveViewerDay(1);assert.equal(f.photos()[f.context.viewerPhotoIndex].id,'b1');
});

test('desktop Comments preserve the trip roll or deliberate Places collection',()=>{
 const f=photoEntryFixture(journey);f.open('a1');
 f.context.openCommentPhoto('b1',{photos:f.photos(),preserveCollection:true});
 assert.equal(f.context.viewerCollection,null);assert.equal(f.context.viewerPhotoIndex,2);
 f.open('a1',{photos:[journey.photos[1],journey.photos[0]],collectionLabel:'A saved place'});
 f.context.moveViewer(1);assert.equal(f.context.viewerPhotoIndex,1);
 f.context.moveViewerDay(1);assert.equal(f.context.viewerPhotoIndex,1);
 f.context.openCommentPhoto('b1',{photos:f.photos(),preserveCollection:true});
 assert.equal(f.context.viewerCollection.label,'A saved place');assert.equal(f.context.viewerPhotoIndex,0);
});
