(function(root) {
  'use strict';
  const model = root.JOURNEY_ATLAS_PHOTO_PLACES;
  function create(options) {
    const card = document.getElementById('map-photo-card'), image = card.querySelector('img');
    const $ = selector => card.querySelector(selector), auth = () => root.JOURNEY_ATLAS_AUTH;
    let selection = null, markerMap = null, frame = 0, exact = null, gesture = null;
    const markers = new Map();
    const phone = () => matchMedia('(max-width:900px)').matches;
    const photos = () => options.photos().filter(model.visible);
    const selected = () => selection ? model.retainedSelection(selection,photos()) : null;
    const members = () => selection ? selection.ids.map(id=>photos().find(photo=>photo.id===id)).filter(Boolean) : [];
    const current = () => members().find(photo=>photo.id===selection?.photoId);
    function historyWrite(push = false) {
      history[push ? 'pushState' : 'replaceState']({...history.state,...(!options.placesOpen() && history.state?.atlasPlaces ? {atlasPlaces:{...history.state.atlasPlaces,open:false,depth:0}} : {}),atlasPhotoBubble:selection && {...selection}},'',location.href);
    }
    function clearImage(node) { auth()?.clearImage(node); node.onload = node.onerror = null; node.removeAttribute('src'); }
    function loadImage(node,photo,width) {
      clearImage(node); node.alt=photo.alt || photo.caption || 'Trip photo';
      node.hidden=Boolean(auth()?.isProtected(photo) && !auth()?.unlocked);
      if(node===image){$('[data-bubble-image-status]').textContent=node.hidden?'':'Loading photo…';$('[data-bubble-retry]').hidden=true;}
      if(node.hidden)return;
      node.onerror=()=>{node.hidden=true;if(node===image){$('[data-bubble-image-status]').textContent='This photo could not load.';$('[data-bubble-retry]').hidden=false;}}; node.onload=()=>{node.hidden=false;if(node===image){$('[data-bubble-image-status]').textContent='';$('[data-bubble-retry]').hidden=true;}};
      if(auth()?.isProtected(photo))auth().setImage(node,photo,width);else node.src=options.photoUrl(photo,width);
    }
    function syncVisibility() {
      const shown=Boolean(selection && !options.placesOpen());
      card.hidden=!shown;document.body.classList.toggle('bubble-card-open',shown);
      if(phone())document.querySelector('.mobile-day-summary').before(card);
      else document.querySelector('.story-album-entry').append(card);
      requestAnimationFrame(()=>options.map()?.resize());
    }
    function removeMarker(key,entry){clearImage(entry.thumbnail);entry.marker.remove();markers.delete(key);}
    function clearMarkers(){for(const [key,entry] of markers)removeMarker(key,entry);}
    function close({write=true,focus=false}={}) {
      const anchor=selection?.ids[0];selection=null;exact?.remove();exact=null;clearImage(image);syncVisibility();schedule();
      if(write)historyWrite();options.photoChanged?.(null);
      if(focus)requestAnimationFrame(()=>document.querySelector(`[data-bubble-anchor="${CSS.escape(anchor || '')}"]`)?.focus({preventScroll:true}));
    }
    function open(items,photoId=items[0]?.id,{write=true}={}) {
      const ids=items.filter(model.visible).map(photo=>photo.id); if(!ids.length)return;
      const push=!selection || Boolean(history.state?.atlasPlaces?.open);selection={journeyId:options.journey().id,dayId:options.dayId(),ids,photoId:ids.includes(photoId)?photoId:ids[0]};
      options.explore();update();if(write)historyWrite(push);schedule();
      if(!phone())document.querySelector('.story-panel').scrollTop=0;
      $('[data-bubble-close]').focus({preventScroll:true});
    }
    function update() {
      selection=selected();syncVisibility();if(!selection){exact?.remove();exact=null;clearImage(image);options.photoChanged?.(null);return;}
      const photo=current();if(card.dataset.photoId!==photo.id){exact?.remove();exact=null;}if(photo.dayId!==options.dayId()){selection.dayId=photo.dayId;options.selectPhotoDay?.(photo.dayId);}
      const list=members(), index=list.indexOf(photo), place=model.placeForPhoto(photo,options.journey().pointsOfInterest || []);
      loadImage(image,photo,720);
      $('[data-bubble-title]').textContent=place ? `At ${place.point.name}` : (photo.locationLabel || photo.takenAt || 'Photo');
      const day=options.journey().days.find(day=>day.id===photo.dayId);$('[data-bubble-day]').textContent=day ? `${root.JOURNEY_ATLAS_UTILS.eventWord(options.journey(),'title')} ${day.number} · ${day.title}` : '';
      $('[data-bubble-caption]').textContent=photo.caption || ''; $('[data-bubble-caption]').hidden=!photo.caption;
      $('[data-bubble-description]').textContent=photo.description || ''; $('[data-bubble-notes]').hidden=!photo.description;
      $('[data-bubble-count]').textContent=`${index+1} of ${list.length}`;
      $('[data-bubble-prev]').disabled=index===0;$('[data-bubble-next]').disabled=index===list.length-1;
      $('[data-bubble-locate]').disabled=!model.located(photo);
      $('[data-bubble-location]').textContent=model.located(photo)?'':'No saved photo location. It remains in the album.';
      $('[data-bubble-place]').hidden=!place;if(place){$('[data-bubble-place]').textContent=`About ${place.point.name} →`;$('[data-bubble-place]').dataset.placeId=place.point.id;}
      $('[data-bubble-unlock]').hidden=!auth()?.isProtected(photo)||Boolean(auth()?.unlocked);
      card.dataset.photoId=photo.id;options.photoChanged?.(photo);$('[data-bubble-comments]').hidden=!options.commentsAvailable?.();
    }
    function step(delta) {
      const list=members(),index=list.findIndex(photo=>photo.id===selection?.photoId),photo=list[index+delta];if(!photo)return;
      selection.photoId=photo.id;exact?.remove();exact=null;update();historyWrite();schedule();
    }
    function schedule(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;draw();});}
    function obstacles(map) {
      const container=map.getContainer(),r=container.getBoundingClientRect();
      return [...document.querySelectorAll('#map .day-marker,#map .route-endpoint-marker,#map .pp-pin,#map .pp-pin-label,#map .maplibregl-ctrl-group,#map .maplibregl-ctrl-attrib,#day-navigator,#map-legend')].filter(node=>node.getClientRects().length&&!node.hidden).map(node=>{const n=node.getBoundingClientRect();return {left:n.left-r.left-5,right:n.right-r.left+5,top:n.top-r.top-5,bottom:n.bottom-r.top+5};});
    }
    function draw() {
      const map=options.map();if(!map||!options.ready()){clearMarkers();return;}
      if(selection && (selection.journeyId!==options.journey().id || selection.dayId!==options.dayId())){close();return;}
      if(options.scope()!=='day'){clearMarkers();return;}
      // Move-end will lay out the settled view. Keep existing thumbnails alive
      // during camera transitions and ordinary resize/selection refreshes.
      if(map.isMoving())return;
      const viewport={width:map.getContainer().clientWidth,height:map.getContainer().clientHeight};
      if(!viewport.width||!viewport.height)return;
      const visible=photos().filter(photo=>photo.dayId===options.dayId()&&model.located(photo)).filter(photo=>{const point=map.project([photo.lng,photo.lat]);return point.x>=0&&point.y>=0&&point.x<=viewport.width&&point.y<=viewport.height;});
      const picked=members().filter(model.located),groups=model.bubbleGroups(visible,picked,p=>map.project(p),map.getZoom()>=10?106:78,phone()?4:6),boxes=obstacles(map);
      const visibleIds=new Set(visible.map(photo=>photo.id)),retained=new Set();
      for(const group of groups){
        const key=group.photos[0].id,active=Boolean(selection?.ids.includes(key));
        const candidates=group.photos.filter(photo=>visibleIds.has(photo.id));
        let size=model.bubbleSize(map.getZoom(),active),placement,anchor;
        // A retained group can span the viewport edge or a crowded place pin.
        // Its album order must not make the whole group disappear.
        for(const candidateSize of [...new Set([size,40])]){
          size=candidateSize;
          for(const photo of candidates){placement=model.bubblePlacement(map.project([photo.lng,photo.lat]),size,viewport,boxes);if(placement){anchor=photo;break;}}
          if(placement)break;
        }
        if(!placement)continue;boxes.push(placement.box);retained.add(key);
        let entry=markers.get(key);
        if(!entry){
          const node=document.createElement('div'),button=document.createElement('button');
          button.type='button';button.className='photo-bubble';button.dataset.bubbleAnchor=key;
          const thumbnail=document.createElement('img'),fallback=document.createElement('span'),count=document.createElement('span');
          fallback.className='bubble-fallback';fallback.textContent='▧';fallback.setAttribute('aria-hidden','true');count.className='bubble-count';
          button.append(fallback,thumbnail,count);node.append(button);
          const marker=new root.maplibregl.Marker({element:node,anchor:'center',offset:placement.offset}).setLngLat([anchor.lng,anchor.lat]).addTo(map);
          entry={node,button,thumbnail,count,marker};markers.set(key,entry);
        }
        const {node,button,thumbnail,count,marker}=entry;
        node.classList.toggle('bubble-anchor',true);node.classList.toggle('is-selected',active);
        node.style.setProperty('--bubble-size',`${size}px`);node.style.setProperty('--bubble-leader',`${Math.hypot(...placement.offset)}px`);node.style.setProperty('--bubble-angle',`${Math.atan2(-placement.offset[1],-placement.offset[0])*180/Math.PI}deg`);
        button.setAttribute('aria-label',`Browse ${group.photos.length} ${group.photos.length===1?'photo':'photos'}`);button.setAttribute('aria-pressed',String(active));
        count.textContent=group.photos.length>1?group.photos.length:'';count.hidden=group.photos.length<=1;
        button.onclick=event=>{event.stopPropagation();options.closePlaces();open(group.photos,active?selection.photoId:anchor.id);};
        const position=JSON.stringify([anchor.lng,anchor.lat,placement.offset]);
        if(entry.position!==position){marker.setLngLat([anchor.lng,anchor.lat]);marker.setOffset(placement.offset);entry.position=position;}
        const photo=active?current():group.photos[0],imageKey=JSON.stringify([photo,auth()?.unlocked]);
        if(entry.imageKey!==imageKey){loadImage(thumbnail,photo,160);entry.imageKey=imageKey;}
      }
      for(const [key,entry] of markers)if(!retained.has(key))removeMarker(key,entry);
    }
    function refresh(){if(selection){if(selection.journeyId!==options.journey().id||selection.dayId!==options.dayId())close();else update();}schedule();}
    function mapReady(){const map=options.map();if(map===markerMap)return;clearMarkers();markerMap?.off('moveend',schedule);markerMap?.off('resize',schedule);markerMap=map;map?.on('moveend',schedule);map?.on('resize',schedule);schedule();}
    $('[data-bubble-close]').onclick=()=>{if(history.state?.atlasPhotoBubble && !options.placesOpen())history.back();else close({focus:true});};
    $('[data-bubble-prev]').onclick=()=>step(-1);$('[data-bubble-next]').onclick=()=>step(1);
    $('[data-bubble-full]').onclick=()=>current()&&options.fullscreen(current().id);
    $('[data-bubble-place]').onclick=()=>options.openPlace($('[data-bubble-place]').dataset.placeId);
    $('[data-bubble-retry]').onclick=()=>{if(current())loadImage(image,current(),720);};
    $('[data-bubble-comments]').onclick=()=>options.comments?.();
    $('[data-bubble-unlock]').onclick=()=>auth()?.showPrompt();
    $('[data-bubble-locate]').onclick=()=>{const photo=current(),map=options.map();if(!photo||!model.located(photo)||!options.ready())return;exact?.remove();const node=document.createElement('div');node.className='bubble-exact-pin';node.setAttribute('role','img');node.setAttribute('aria-label','Saved photo location');exact=new root.maplibregl.Marker({element:node}).setLngLat([photo.lng,photo.lat]).addTo(map);map.easeTo({center:[photo.lng,photo.lat],duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:300});};
    const stage=$('.bubble-card-image');
    stage.addEventListener('pointerdown',event=>{if(event.isPrimary!==false)gesture={x:event.clientX,y:event.clientY,id:event.pointerId};});
    stage.addEventListener('pointerup',event=>{if(gesture?.id!==event.pointerId)return;const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;gesture=null;if(Math.abs(dx)>28&&Math.abs(dx)>Math.abs(dy)*1.25)step(dx<0?1:-1);});stage.addEventListener('pointercancel',()=>gesture=null);
    card.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();step(event.key==='ArrowLeft'?-1:1);}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();$('[data-bubble-close]').click();}});
    window.addEventListener('atlas-photos-locked',()=>{exact?.remove();exact=null;update();schedule();});window.addEventListener('atlas-photos-unlocked',()=>{update();schedule();});
    window.addEventListener('resize',()=>{syncVisibility();schedule();});
    window.addEventListener('popstate',event=>{const saved=event.state?.atlasPhotoBubble;selection=saved?.journeyId===options.journey().id&&saved.dayId===options.dayId()?saved:null;update();schedule();});
    return {open,close,refresh,mapReady,placesChanged:()=>{syncVisibility();schedule();},isOpen:()=>Boolean(selection)};
  }
  root.JOURNEY_ATLAS_PHOTO_BUBBLES={create};
})(typeof window==='undefined'?globalThis:window);
