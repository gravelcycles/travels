(function(root) {
  'use strict';
  const model = root.JOURNEY_ATLAS_PHOTO_PLACES;
  function create(options) {
    const card = document.getElementById('map-photo-card'), image = card.querySelector('img');
    const $ = selector => card.querySelector(selector), auth = () => root.JOURNEY_ATLAS_AUTH;
    let selection = null, selectionLayer = null, markerMap = null, frame = 0, exact = null, gesture = null, suppressPhotoClick = false, sidebarPhotoMode = false;
    const markers = new Map();
    const phone = () => matchMedia('(max-width:900px)').matches;
    const photos = () => options.photos().filter(model.visible);
    const selected = () => {
      if (!selection) return null;
      const visible = photos();
      return model.retainedSelection(selection.browseJourney ? {...selection,ids:visible.map(photo=>photo.id)} : selection,visible);
    };
    const members = () => {
      if (!selection) return [];
      const visible = new Map(photos().map(photo=>[photo.id,photo]));
      return selection.ids.map(id=>visible.get(id)).filter(Boolean);
    };
    const current = () => members().find(photo=>photo.id===selection?.photoId);
    function historyWrite(push = false) {
      if (history.state?.mobileAtlas?.viewer) selectionLayer = 'viewer';
      else if (history.state?.mobileAtlas?.overlay === 'comments-dialog') selectionLayer = 'comments';
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
      if(phone()){
        const summary=document.querySelector('.mobile-day-summary');
        if(card.nextElementSibling!==summary)summary.before(card);
      }else{
        const album=document.querySelector('.story-album-entry');
        if(card.parentElement!==album)album.append(card);
      }
      const desktopSelection=shown&&!phone(),details=document.getElementById('sidebar-day-details'),strip=document.querySelector('.photo-section');
      if(desktopSelection){if(strip.nextElementSibling!==details)details.before(strip);}
      else if(details.nextElementSibling!==strip)details.after(strip);
      if(desktopSelection!==sidebarPhotoMode){details.open=!desktopSelection;sidebarPhotoMode=desktopSelection;}
      requestAnimationFrame(()=>options.map()?.resize());
    }
    function removeMarker(key,entry){clearImage(entry.thumbnail);entry.marker.remove();markers.delete(key);}
    function clearMarkers(){for(const [key,entry] of markers)removeMarker(key,entry);}
    function close({write=true,focus=false}={}) {
      const anchor=selection?.ids[0];selection=null;selectionLayer=null;exact?.remove();exact=null;clearImage(image);syncVisibility();schedule();
      if(write)historyWrite();options.photoChanged?.(null);
      if(focus)requestAnimationFrame(()=>document.querySelector(`[data-bubble-anchor="${CSS.escape(anchor || '')}"]`)?.focus({preventScroll:true}));
    }
    function open(items,photoId=items[0]?.id,{write=true,mapGroup=false,label='Map photos',preserveCollection=false,browseJourney=false}={}) {
      const groupIds=items.filter(model.visible).map(photo=>photo.id);
      const ids=(browseJourney ? photos() : items.filter(model.visible)).map(photo=>photo.id); if(!ids.length)return;
      const push=!selection || Boolean(history.state?.atlasPlaces?.open);
      selection=preserveCollection && selection?.ids.includes(photoId)
        ? {...selection,dayId:options.dayId(),photoId}
        : {journeyId:options.journey().id,dayId:options.dayId(),ids,mapGroup,groupIds,browseJourney,label:browseJourney ? options.journey().title || 'Journey photos' : label,photoId:ids.includes(photoId)?photoId:ids[0]};
      options.closePlaces();options.explore();update();if(write)historyWrite(push);schedule();
      if(!phone())document.querySelector('.story-panel').scrollTop=0;
      $('[data-bubble-full]').focus({preventScroll:true});
    }
    function update() {
      selection=selected();syncVisibility();if(!selection){exact?.remove();exact=null;clearImage(image);options.photoChanged?.(null);return;}
      const photo=current();
      if(card.dataset.photoId!==photo.id){exact?.remove();exact=null;}if(photo.dayId!==options.dayId()){selection.dayId=photo.dayId;options.selectPhotoDay?.(photo.dayId);}
      const list=members(), index=list.indexOf(photo), place=model.placeForPhoto(photo,options.journey().pointsOfInterest || []);
      loadImage(image,photo,1280);
      $('[data-bubble-title]').textContent=place ? `At ${place.point.name}` : (photo.locationLabel || photo.takenAt || 'Photo');
      const day=options.journey().days.find(day=>day.id===photo.dayId);$('[data-bubble-day]').textContent=day ? `${root.JOURNEY_ATLAS_UTILS.eventWord(options.journey(),'title')} ${day.number} · ${day.title}` : '';
      $('[data-bubble-caption]').textContent=photo.caption || '';$('[data-bubble-caption]').hidden=!photo.caption?.trim();
      $('[data-bubble-description]').textContent=photo.description || ''; $('[data-bubble-description]').hidden=!photo.description;
      $('[data-bubble-count]').textContent=`${index+1} / ${list.length}`;
      $('[data-bubble-count]').setAttribute('aria-label',`Photo ${index+1} of ${list.length} ${selection.browseJourney ? 'in the trip' : 'in this selection'}`);
      document.getElementById('sidebar-day-summary').textContent=day?`${root.JOURNEY_ATLAS_UTILS.eventWord(options.journey(),'title')} details · ${day.title}`:'Day details';
      $('[data-bubble-prev]').disabled=index===0;$('[data-bubble-next]').disabled=index===list.length-1;
      $('[data-bubble-locate]').disabled=!model.located(photo);
      $('[data-bubble-location]').textContent=model.located(photo)?'':'No saved photo location. It remains in the album.';
      $('[data-bubble-place]').hidden=!place;if(place){$('[data-bubble-place]').textContent=`About ${place.point.name} →`;$('[data-bubble-place]').dataset.placeId=place.point.id;}
      $('[data-bubble-unlock]').hidden=!auth()?.isProtected(photo)||Boolean(auth()?.unlocked);
      card.dataset.photoId=photo.id;options.photoChanged?.(photo);$('[data-bubble-comments]').hidden=!options.commentsAvailable?.();
    }
    function viewerPhotoChanged(photo) {
      if (!photo || !selection?.ids.includes(photo.id) || !selection.browseJourney && photo.dayId !== selection.dayId) return;
      // Keep the presenting sidebar in step with the full viewer without
      // loading an obscured image or changing the viewer's conversation.
      selection.photoId = photo.id; selection.dayId = photo.dayId; selectionLayer = 'viewer';
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
      const picked=selection?.mapGroup?photos().filter(photo=>(selection.groupIds || selection.ids).includes(photo.id)&&photo.dayId===options.dayId()&&model.located(photo)):[],groups=model.bubbleGroups(visible,picked,p=>map.project(p),map.getZoom()>=10?106:78,phone()?4:6),boxes=obstacles(map);
      const visibleIds=new Set(visible.map(photo=>photo.id)),retained=new Set();
      for(const group of groups){
        const key=group.photos[0].id,active=group.photos.some(photo=>photo.id===selection?.photoId);
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
        node.classList.toggle('bubble-anchor',true);node.classList.toggle('is-selected',active);node.classList.toggle('is-quiet',Boolean(selection)&&!active);
        node.style.setProperty('--bubble-size',`${size}px`);node.style.setProperty('--bubble-leader',`${Math.hypot(...placement.offset)}px`);node.style.setProperty('--bubble-angle',`${Math.atan2(-placement.offset[1],-placement.offset[0])*180/Math.PI}deg`);
        button.setAttribute('aria-label',group.photos.length===1?'Select photo':`Browse ${group.photos.length} photos`);button.setAttribute('aria-pressed',String(active));
        count.textContent=group.photos.length>1?group.photos.length:'';count.hidden=group.photos.length<=1;
        button.onclick=event=>{
          event.stopPropagation();
          open(group.photos,anchor.id,{mapGroup:true,browseJourney:!phone()});
        };
        const position=JSON.stringify([anchor.lng,anchor.lat,placement.offset]);
        if(entry.position!==position){marker.setLngLat([anchor.lng,anchor.lat]);marker.setOffset(placement.offset);entry.position=position;}
        const photo=anchor,imageKey=JSON.stringify([photo,auth()?.unlocked]);
        if(entry.imageKey!==imageKey){loadImage(thumbnail,photo,160);entry.imageKey=imageKey;}
      }
      for(const [key,entry] of markers)if(!retained.has(key))removeMarker(key,entry);
    }
    function refresh(){if(selection){if(selection.journeyId!==options.journey().id||selection.dayId!==options.dayId())close();else update();}schedule();}
    function mapReady(){const map=options.map();if(map===markerMap)return;clearMarkers();markerMap?.off('moveend',schedule);markerMap?.off('resize',schedule);markerMap=map;map?.on('moveend',schedule);map?.on('resize',schedule);schedule();}
    $('[data-bubble-close]').onclick=()=>{if(history.state?.atlasPhotoBubble && !options.placesOpen())history.back();else close({focus:true});};
    $('[data-bubble-prev]').onclick=()=>step(-1);$('[data-bubble-next]').onclick=()=>step(1);
    $('[data-bubble-full]').onclick=event=>{
      const suppress=event.detail>0&&suppressPhotoClick;suppressPhotoClick=false;
      if(suppress){event.preventDefault();return;}
      const photo=current();if(!photo)return;
      if(auth()?.isProtected(photo)&&!auth()?.unlocked)auth()?.showPrompt();
      else options.fullscreen(photo.id,members(),selection.label || 'Map photos',{browseJourney:Boolean(selection.browseJourney)});
    };
    $('[data-bubble-place]').onclick=()=>options.openPlace($('[data-bubble-place]').dataset.placeId);
    $('[data-bubble-retry]').onclick=()=>{if(current())loadImage(image,current(),1280);};
    $('[data-bubble-comments]').onclick=()=>options.comments?.();
    $('[data-bubble-unlock]').onclick=()=>auth()?.showPrompt();
    $('[data-bubble-locate]').onclick=()=>{const photo=current(),map=options.map();if(!photo||!model.located(photo)||!options.ready())return;exact?.remove();const node=document.createElement('div');node.className='bubble-exact-pin';node.setAttribute('role','img');node.setAttribute('aria-label','Saved photo location');exact=new root.maplibregl.Marker({element:node}).setLngLat([photo.lng,photo.lat]).addTo(map);map.easeTo({center:[photo.lng,photo.lat],duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:300});};
    const stage=$('[data-bubble-full]');
    stage.addEventListener('pointerdown',event=>{
      if(event.isPrimary===false)return;
      suppressPhotoClick=false;gesture={x:event.clientX,y:event.clientY,id:event.pointerId};
    });
    stage.addEventListener('pointerup',event=>{
      if(gesture?.id!==event.pointerId)return;
      const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;gesture=null;
      suppressPhotoClick=Math.hypot(dx,dy)>8;
      if(Math.abs(dx)>28&&Math.abs(dx)>Math.abs(dy)*1.25)step(dx<0?1:-1);
    });
    stage.addEventListener('pointercancel',()=>{gesture=null;suppressPhotoClick=true;});
    card.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();step(event.key==='ArrowLeft'?-1:1);}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();$('[data-bubble-close]').click();}});
    window.addEventListener('atlas-photos-locked',()=>{exact?.remove();exact=null;update();schedule();});window.addEventListener('atlas-photos-unlocked',()=>{update();schedule();});
    window.addEventListener('resize',()=>{syncVisibility();schedule();});
    window.addEventListener('popstate',event=>{
      const saved=event.state?.atlasPhotoBubble;
      const valid=saved?.journeyId===options.journey().id&&(saved.browseJourney || saved.dayId===options.dayId())?saved:null;
      const sameCollection=selection && valid && selection.journeyId===valid.journeyId && JSON.stringify(selection.ids)===JSON.stringify(valid.ids);
      const retainPhoto=Boolean(selectionLayer && sameCollection && valid.ids.includes(selection.photoId));
      selection=valid?{...valid,...(retainPhoto?{photoId:selection.photoId,dayId:selection.dayId}: {})}:null;
      const foreground=event.state?.mobileAtlas?.viewer || event.state?.mobileAtlas?.overlay==='comments-dialog';
      if(!foreground)selectionLayer=null;
      update();schedule();
      // Replace only this surface's state. A subsequent Back still closes the
      // selection, and unrelated Places scope/scroll/navigation stays intact.
      if(retainPhoto)history.replaceState({...history.state,atlasPhotoBubble:{...selection}},'',location.href);
    });
    return {open,close,refresh,mapReady,viewerPhotoChanged,currentPhoto:current,clearMap:clearMarkers,collection:()=>selection?{photos:members(),label:selection.label || 'Map photos',browseJourney:Boolean(selection.browseJourney)}:null,placesChanged:()=>{syncVisibility();schedule();},isOpen:()=>Boolean(selection)};
  }
  root.JOURNEY_ATLAS_PHOTO_BUBBLES={create};
})(typeof window==='undefined'?globalThis:window);
