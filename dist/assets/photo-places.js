(function(root) {
  'use strict';
  const located = photo => Number.isFinite(photo?.lng) && Number.isFinite(photo?.lat) && Math.abs(photo.lng) <= 180 && Math.abs(photo.lat) <= 90;
  const visible = photo => !photo.hidden && !photo.trashed && photo.mediaType !== 'video';
  // Only the owner's saved links associate a photo with a place.
  function photosForPlace(point, photos) {
    const eligible = photos.filter(visible), byId = new Map(eligible.map(photo => [photo.id, photo]));
    const linked = (point.photoIds || []).map(id => byId.get(id)).filter(Boolean);
    return {linked};
  }
  function placeForPhoto(photo, points) {
    const explicit = points.find(point => point.photoIds?.includes(photo.id));
    return explicit ? {point:explicit} : null;
  }
  function retainedSelection(selection, photos) {
    if (!selection) return null;
    const eligible = new Map(photos.filter(visible).map(photo=>[photo.id,photo]));
    const members = selection.ids.map(id=>eligible.get(id)).filter(Boolean);
    if (!members.length) return null;
    return {...selection,ids:members.map(photo=>photo.id),photoId:members.some(photo=>photo.id===selection.photoId)?selection.photoId:members[0].id};
  }
  function groupPhotos(photos, project, radius = 70, limit = 6) {
    let groups = photos.filter(p => Number.isFinite(p.lng) && Number.isFinite(p.lat) && Math.abs(p.lng)<=180 && Math.abs(p.lat)<=90)
      .map((photo, order) => ({photos:[photo], point:project([photo.lng,photo.lat]), order}));
    while(groups.length > 1) {
      let best = Infinity, pair;
      for(let i=0;i<groups.length;i++) for(let j=i+1;j<groups.length;j++) {
        const d = Math.hypot(groups[i].point.x-groups[j].point.x,groups[i].point.y-groups[j].point.y);
        if(d < best) { best=d; pair=[i,j]; }
      }
      if(best >= radius && groups.length <= limit) break;
      const [i,j] = pair;
      groups[i].photos.push(...groups[j].photos); groups.splice(j,1);
    }
    const order = new Map(photos.map((p,i)=>[p.id,i]));
    return groups.map(g=>({...g,photos:g.photos.sort((a,b)=>order.get(a.id)-order.get(b.id))}));
  }
  function bubblePlacement(point,size,viewport,obstacles=[],routePoints=[]) {
    const radius=size/2,pad=6,offsets=[[0,-size/2-12],[size/2+14,-20],[-size/2-14,-20],[0,size/2+14],[size/2+20,size/2+16],[-size/2-20,size/2+16],[size+15,0],[-size-15,0]];
    let best=null;
    for(const [dx,dy] of offsets){const x=point.x+dx,y=point.y+dy,box={left:x-radius-pad,top:y-radius-pad,right:x+radius+pad,bottom:y+radius+pad};if(box.left<6||box.top<6||box.right>viewport.width-6||box.bottom>viewport.height-6)continue;if(obstacles.some(b=>box.left<b.right&&box.right>b.left&&box.top<b.bottom&&box.bottom>b.top))continue;const overlap=routePoints.reduce((sum,p)=>sum+(Math.hypot(p.x-x,p.y-y)<radius+5?1:0),0);const score=overlap*10+Math.hypot(dx,dy)*.05;if(!best||score<best.score)best={offset:[dx,dy],box,score};}
    return best;
  }
  function bubbleGroups(visiblePhotos,selectedPhotos,project,radius,limit) {
    const selectedIds=new Set(selectedPhotos.map(p=>p.id));
    const visibleIds=new Set(visiblePhotos.map(p=>p.id));
    const groups=groupPhotos(visiblePhotos.filter(p=>!selectedIds.has(p.id)),project,radius,Math.max(1,limit-(selectedPhotos.length?1:0)));
    if(selectedPhotos.some(p=>visibleIds.has(p.id)))groups.unshift({photos:selectedPhotos});
    return groups;
  }
  function bubbleSize(zoom,selected=false) {return selected?64:Math.round(40+8*Math.max(0,Math.min(1,(zoom-9)/3)));}
  root.JOURNEY_ATLAS_PHOTO_PLACES = {located,visible,photosForPlace,placeForPhoto,retainedSelection,groupPhotos,bubblePlacement,bubbleGroups,bubbleSize};
})(typeof window === 'undefined' ? globalThis : window);
