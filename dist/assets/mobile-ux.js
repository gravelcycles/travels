(function (root) {
  'use strict';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function gestureAxis(dx, dy) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 9) return null;
    if (Math.abs(dx) > Math.abs(dy) * 1.2) return 'x';
    if (Math.abs(dy) > Math.abs(dx) * 1.2) return 'y';
    return null;
  }
  function swipeStep(dx, elapsed, width, index, count) {
    const commit = Math.abs(dx) > Math.min(90, width * .22) || (Math.abs(dx) > 28 && Math.abs(dx) / Math.max(1, elapsed) > .5);
    const step = dx < 0 ? 1 : -1;
    return commit && index + step >= 0 && index + step < count ? step : 0;
  }
  function panLimit(size, scale, viewport) { return Math.max(0, (size * scale - viewport) / 2); }

  function create(api) {
    const $ = selector => document.querySelector(selector);
    const media = matchMedia('(max-width: 900px)'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const dialog = $('#photo-dialog'), viewer = $('.photo-viewer'), stage = $('.photo-stage'), img = $('#modal-photo');
    const panel = $('#photo-location-panel'), strip = $('#viewer-filmstrip');
    let current = { photos: [], index: 0, day: null }, locationOpen = false, grid = false, chrome = true;
    let reveal = 0, locationHeight = 300, scale = 1, panX = 0, panY = 0;
    let gesture = null, pointers = new Map(), pinch = null, suppressClick = false;
    let locationTimer, swipeTimer, swipeFrame;
    let replayView = 'map', replayState = null;
    let restoring = false, previousState = null, lastTap = null, viewerDepth = 0, fromAlbum = false, exitingToDay = false;
    const neighbors = [-1, 1].map(delta => {
      const node = document.createElement('img'); node.className = 'mobile-photo-neighbor'; node.alt = ''; node.setAttribute('aria-hidden', 'true'); node.draggable = false;
      $('#viewer-photo-frame').append(node); return {node, delta};
    });
    const enabled = () => media.matches;
    function snapshot() {
      return {dayId: api.day().id, tab: $('.atlas-shell').dataset.mobileTab || 'map', viewer: dialog.open,
        viewerDay: current.day?.id, index: current.index, scope:api.scope(), depth:dialog.open?viewerDepth:0, fromAlbum, layer: grid ? 'grid' : locationOpen ? 'location' : 'photo'};
    }
    function save(push = false) {
      if (!enabled() || restoring) return;
      const state = snapshot();
      history[push ? 'pushState' : 'replaceState']({...history.state, mobileAtlas: state}, '', location.href);
      previousState = state;
    }
    function exitToDay() {
      exitingToDay = true; fromAlbum = false;
      dialog.close(); api.tab('map');
    }
    function openGrid(dayId) { api.openDay(dayId); setGrid(true); }
    function back() {
      if (history.state?.mobileAtlas?.viewer) { history.back(); return; }
      dialog.close();
    }
    function navigate(tab, push = true) {
      if (push) { save(); history.pushState({...history.state}, '', location.href); }
      api.tab(tab); save();
    }
    function placeReplayPhoto() {
      // Keep the mobile image out of the scrolling story's clipping and
      // compositing layers. Move the same image back into the desktop card.
      const host = $(enabled() ? '#replay-photo-stage' : '#replay-photo-slot');
      const frame = $('#replay-photo-frame');
      if (frame.parentElement !== host) host.append(frame);
    }
    function measureReplay() {
      const player = $('.replay-player');
      if (!enabled() || !$('#replay-dialog').open) return;
      player.style.setProperty('--replay-controls-height', `${$('.replay-controls').offsetHeight}px`);
      player.style.setProperty('--replay-story-height', `${$('.replay-story').offsetHeight}px`);
    }
    function setReplayView(value) {
      replayView = value === 'photos' && !$('#replay-photo-frame').hidden ? 'photos' : 'map';
      $('.replay-player').dataset.replayView = replayView;
      $('#replay-view-map').setAttribute('aria-pressed', String(replayView === 'map'));
      $('#replay-view-photos').setAttribute('aria-pressed', String(replayView === 'photos'));
      $('#replay-map').inert = enabled() && replayView === 'photos';
      $('#replay-map').setAttribute('aria-hidden', String(enabled() && replayView === 'photos'));
      measureReplay();
      if (replayView === 'map') requestAnimationFrame(() => api.replayMap?.());
    }
    function replayControlsChanged({playing, completed, day}) {
      replayState = {playing, completed, day};
      $('#replay-view-photos').disabled = $('#replay-photo-frame').hidden;
      $('#replay-explore-day').textContent = `Explore Day ${day.number}`;
      if (replayView === 'photos' && $('#replay-photo-frame').hidden) setReplayView('map');
      if (enabled()) {
        const symbol = playing ? '<path d="M8 5v14M16 5v14" stroke-width="4"/>' : completed ? '<path d="M5 8a8 8 0 1 1-1 8M5 3v5h5"/>' : '<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>';
        $('#replay-toggle').innerHTML = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false">${symbol}</svg>`;
      } else $('#replay-toggle').textContent = playing ? 'Pause' : completed ? 'Replay' : 'Play';
      measureReplay();
    }
    $('#replay-view-map').onclick = () => setReplayView('map');
    $('#replay-view-photos').onclick = () => setReplayView('photos');
    $('#mobile-replay-back').onclick = () => $('#replay-dialog').close();
    const replayLayoutObserver = new ResizeObserver(measureReplay);
    replayLayoutObserver.observe($('.replay-controls')); replayLayoutObserver.observe($('.replay-story'));
    new ResizeObserver(() => { if (enabled() && replayView === 'map' && $('#replay-dialog').open) api.replayMap?.(); }).observe($('#replay-map'));
    placeReplayPhoto();
    function renderDay() {
      const day = api.day(), info = api.dayInfo(day), index = api.days().findIndex(d => d.id === day.id);
      for (const prefix of ['mobile-day', 'mobile-story']) {
        $(`#${prefix}-date`).textContent = prefix === 'mobile-day' ? day.date : `Day ${day.number} · ${day.date}`;
        $(`#${prefix}-title`).textContent = day.title;
        $(`#${prefix}-meta`).textContent = prefix === 'mobile-story' ? `${info.route} · ${info.meta}` : info.meta;
      }
      $('#mobile-story-legend').innerHTML = $('#map-legend').innerHTML;
      $('#mobile-day-photos').textContent = info.count ? `Photos · ${info.count}` : 'No photos yet';
      $('#mobile-day-photos').disabled = !info.count;
      if(api.scope()==='journey') {
        $('#mobile-day-date').textContent='The whole journey';$('#mobile-day-title').textContent=api.title();
        $('#mobile-day-meta').textContent=`${api.days().length} days · Choose a day to explore its route`;
        $('#mobile-day-photos').textContent='All photos';$('#mobile-day-photos').disabled=false;
      }
      $('#mobile-day-details').textContent=api.scope()==='journey'?'Choose a day':'Day details';
      $('#mobile-previous-day').disabled = index <= 0;
      $('#mobile-next-day').disabled = index >= api.days().length - 1;
      $('#mobile-day-picker .button-label').textContent = `Day ${day.number} of ${api.days().length}`;
      $('.map-panel').style.setProperty('--day-summary-height', `${$('.mobile-day-summary').offsetHeight}px`);
      tabChanged();
    }
    function tabChanged() {
      const tab = $('.atlas-shell').dataset.mobileTab;
      $('#mobile-day-picker').setAttribute('aria-expanded', String(tab === 'route'));
      $('#mobile-day-picker').setAttribute('aria-label', `${tab === 'route' ? 'Return to' : 'Choose a day, current'} Day ${api.day().number} of ${api.days().length}`);
      $('[data-journey-action=unlock]').hidden = Boolean(window.JOURNEY_ATLAS_AUTH?.unlocked);
      if (enabled() && tab === 'story') requestAnimationFrame(api.preview);
    }
    function transform(dx = 0) {
      img.style.transform = `translate3d(${dx + panX}px,${panY}px,0) scale(${scale})`;
      neighbors.forEach(({node,delta}) => { node.style.transform = `translate3d(${dx + delta * (stage.clientWidth + 16)}px,0,0)`; });
    }
    function zoom(next) {
      scale = clamp(next, 1, 4); if (scale === 1) panX = panY = 0;
      const ratio = img.naturalWidth / img.naturalHeight || 1;
      const width = Math.min(stage.clientWidth, stage.clientHeight * ratio), height = width / ratio;
      panX = clamp(panX, -panLimit(width,scale,stage.clientWidth), panLimit(width,scale,stage.clientWidth));
      panY = clamp(panY, -panLimit(height,scale,stage.clientHeight), panLimit(height,scale,stage.clientHeight));
      transform();
    }
    function setChrome(value) {
      chrome = value; viewer.dataset.chrome = String(chrome);
      $('.mobile-photo-header').inert = !chrome; $('.mobile-photo-footer').inert = !chrome;
      $('#album-continue').inert = !chrome;
    }
    function measure() {
      locationHeight = Math.min(360, Math.max(150, (viewer.clientHeight - 138) * .52));
      viewer.style.setProperty('--location-height', `${locationHeight}px`);
      reveal = locationOpen ? locationHeight : 0;
      revealTo(reveal);
      zoom(scale);
      $('.map-panel').style.setProperty('--day-summary-height', `${$('.mobile-day-summary').offsetHeight}px`);
    }
    function stopSwipe() {
      cancelAnimationFrame(swipeFrame); clearTimeout(swipeTimer);
      viewer.classList.remove('is-swipe-settling');
    }
    function animateLocation() {
      viewer.classList.add('is-location-settling'); clearTimeout(locationTimer);
      locationTimer = setTimeout(() => viewer.classList.remove('is-location-settling'), reduced.matches ? 0 : 220);
    }
    function settleSwipe(offset) {
      stopSwipe();
      if (reduced.matches || !offset) { transform(); return; }
      transform(offset);
      // Start the incoming photo at the finger's release position. Selection
      // already changed; another gesture can interrupt this visual settling.
      img.getBoundingClientRect();
      swipeFrame = requestAnimationFrame(() => {
        viewer.classList.add('is-swipe-settling'); transform();
        swipeTimer = setTimeout(() => viewer.classList.remove('is-swipe-settling'), 160);
      });
    }
    function revealTo(value) {
      reveal = clamp(value, 0, locationHeight); viewer.style.setProperty('--reveal', `${reveal}px`);
      viewer.dataset.locationVisible = String(reveal > 0);
    }
    function setLocation(value, record = true) {
      if (value && !current.photos.length) return;
      const changed = value !== locationOpen;
      const target = value ? locationHeight : 0;
      if (!changed && reveal === target) return;
      locationOpen = value; setChrome(true); zoom(1); animateLocation(); revealTo(target);
      panel.inert = !value; panel.setAttribute('aria-hidden', String(!value));
      $('#mobile-photo-location').setAttribute('aria-expanded', String(value));
      $('#mobile-photo-location .location-hint').textContent = value ? 'Hide location' : 'Photo location';

      if (value) api.location();
      else { api.pauseLocation?.(); if (enabled()) $('#mobile-photo-location').focus(); }
      // Layers share the viewer's history entry. Dismissing one must not queue
      // a traversal that can later restore an obsolete location or grid state.
      if (record && changed) save();
    }
    function setGrid(value, record = true) {
      const changed = grid !== value;
      if (!changed) return;
      grid = value; viewer.dataset.grid = String(value);
      stage.inert = value; $('.mobile-photo-header').inert = value || !chrome; $('.mobile-photo-footer').inert = value || !chrome;
      panel.inert = value || !locationOpen; $('#album-continue').inert = value || !chrome; strip.inert = !value && enabled();
      if (value) { setChrome(true); $('.mobile-photo-header').inert = true; $('.mobile-photo-footer').inert = true; $('#mobile-grid-back').focus(); }
      else if (enabled()) $('#mobile-photo-grid').focus();
      if (record && changed) save();
    }
    function update(data) {
      current = data; stopSwipe();
      if (!enabled()) return;
      pointers.clear(); gesture = pinch = null; zoom(1);
      panel.inert=!locationOpen||grid;panel.setAttribute('aria-hidden',String(!locationOpen||grid));strip.inert=!grid;
      $('#mobile-photo-back .button-label').textContent = `Day ${data.day.number}`;
      $('#mobile-photo-count').textContent = data.photos.length ? `${data.index + 1} of ${data.photos.length}` : 'No photos';
      $('#mobile-grid-back .button-label').textContent = `Day ${data.day.number}`;
      $('#mobile-grid-title').textContent = `${data.photos.length} photos`;
      const photo = data.photos[data.index];
      $('#mobile-photo-time').textContent = photo?.takenAt || data.day.date;
      $('#mobile-photo-prev').disabled = data.index <= 0;
      $('#mobile-photo-next').disabled = data.index >= data.photos.length - 1;
      $('#mobile-photo-location').disabled = !photo;
      $('#mobile-photo-grid').disabled = !data.photos.length;
      $('#photo-location-title').textContent = photo?.locationLabel || 'Photo location';
      $('#photo-location-subtitle').textContent = Number.isFinite(photo?.lng) && Number.isFinite(photo?.lat) ? `Day ${data.day.number} · ${data.day.title}` : 'No exact location · showing the day’s route';
      neighbors.forEach(({node,delta}) => {
        const adjacent = data.photos[data.index + delta]; node.hidden = !adjacent;
        api.clearImage(node); node.removeAttribute('src');
        if (adjacent) api.loadImage(node, adjacent);
      });
      measure(); transform(); save();
    }
    function open() {
      if (!enabled()) return;
      if (!dialog.open) {
        save(); history.pushState({...history.state}, '', location.href);
        viewerDepth = 1; locationOpen = grid = false; viewer.dataset.grid = 'false'; setChrome(true); revealTo(0);
        panel.inert = true; panel.setAttribute('aria-hidden','true'); strip.inert = true; stage.inert = false;
        $('#mobile-photo-location').setAttribute('aria-expanded','false');
        $('#mobile-photo-location .location-hint').textContent = 'Photo location';

      }
    }
    function closed() {
      neighbors.forEach(({node}) => {api.clearImage(node);node.removeAttribute('src');});
      stopSwipe(); pointers.clear(); gesture = pinch = null; lastTap = null;
      if (enabled() && !restoring && history.state?.mobileAtlas?.viewer) history.go(-Math.max(1,viewerDepth));
    }
    window.addEventListener('popstate', event => {
      const state = event.state?.mobileAtlas;
      if (!enabled() || !state) return;
      const old = previousState; restoring = true;
      viewerDepth = state.depth || 0;
      const targetDay = old?.viewer && !state.viewer ? current.day?.id || state.dayId : state.dayId;
      if(api.day().id !== targetDay) api.selectDay(targetDay);
      const targetTab = !state.viewer && (exitingToDay || old?.viewer) ? 'map' : state.tab;
      if ($('.atlas-shell').dataset.mobileTab !== targetTab) api.tab(targetTab);
      if(!state.viewer && state.scope === 'journey' && !old?.viewer)api.overview();
      if (state.viewer) {
        if (!dialog.open || current.day?.id !== state.viewerDay) api.openDay(state.viewerDay);
        if (!(old?.viewer && old.viewerDay === state.viewerDay)) api.selectPhoto(state.index || 0);
        setLocation(state.layer === 'location', false); setGrid(state.layer === 'grid', false);
      } else if (dialog.open) {dialog.close();if(fromAlbum){fromAlbum=false;api.album();}}
      if(state.viewer && old?.layer === 'grid' && state.layer !== 'grid')$('#mobile-photo-grid').focus();
      else if(state.viewer && old?.layer === 'location' && state.layer !== 'location')$('#mobile-photo-location').focus();
      if(!state.viewer)exitingToDay=false;
      restoring = false; previousState = state;
    });
    function pointerDown(event) {
      if (!enabled() || grid || event.button > 0) return;
      // Only discard the click generated by this drag. A fresh tap (including
      // a tap on Close immediately after dragging) must always be accepted.
      suppressClick = false;
      if (event.target.closest('button:not(#mobile-photo-location)')) return;
      stopSwipe(); clearTimeout(locationTimer); viewer.classList.remove('is-location-settling');
      pointers.set(event.pointerId, {x:event.clientX,y:event.clientY});
      event.currentTarget.setPointerCapture(event.pointerId);
      if (pointers.size === 2) {
        const [a,b] = [...pointers.values()]; pinch = {distance:Math.hypot(a.x-b.x,a.y-b.y),scale};
        gesture = null; suppressClick = true; return;
      }
      gesture = {x:event.clientX,y:event.clientY,time:performance.now(),axis:null,dx:0,dy:0,startReveal:reveal,panX,panY,handle:event.currentTarget !== stage};
    }
    function pointerMove(event) {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if (pinch) {
        if (pointers.size === 2) { const [a,b] = [...pointers.values()]; zoom(pinch.scale * Math.hypot(a.x-b.x,a.y-b.y) / Math.max(1,pinch.distance)); }
        return;
      }
      if (!gesture) return;
      gesture.dx = event.clientX-gesture.x; gesture.dy = event.clientY-gesture.y;
      gesture.axis ||= gestureAxis(gesture.dx, gesture.dy);
      if (!gesture.axis) return;
      suppressClick = true;
      if (scale > 1 && !gesture.handle) {panX=gesture.panX+gesture.dx;panY=gesture.panY+gesture.dy;zoom(scale);return;}
      if (gesture.axis === 'x' && !gesture.handle) {
        const edge = gesture.dx > 0 ? current.index === 0 : current.index === current.photos.length-1;
        transform(gesture.dx * (edge ? .2 : 1));
      } else if (gesture.axis === 'y' && gesture.handle && current.photos.length) {
        setChrome(true); revealTo(gesture.startReveal - gesture.dy);
      }
    }
    function pointerEnd(event) {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (pinch) { if (!pointers.size) {pinch=null;zoom(scale < 1.1 ? 1 : scale);} return; }
      const action = gesture; gesture = null;
      if (!action) return;
      const cancelled = event.type === 'pointercancel';
      if (scale > 1) return;
      if (action.axis === 'x' && !action.handle) {
        const delta = cancelled ? 0 : swipeStep(action.dx, performance.now()-action.time, stage.clientWidth, current.index, current.photos.length);
        const offset = action.dx + delta * (stage.clientWidth + 16);
        if (delta) api.move(delta);
        settleSwipe(delta ? offset : action.dx * (current.index === 0 && action.dx > 0 || current.index === current.photos.length - 1 && action.dx < 0 ? .2 : 1));
      } else if (action.axis === 'y' && action.handle) {
        const target = cancelled ? locationOpen : action.dy < -35 ? true : action.dy > 35 ? false : reveal > locationHeight*.45;
        setLocation(target);
      }
    }
    [stage,$('#mobile-photo-location'),$('.photo-location-heading')].forEach(node => {
      node.addEventListener('pointerdown',pointerDown);node.addEventListener('pointermove',pointerMove);
      node.addEventListener('pointerup',pointerEnd);node.addEventListener('pointercancel',pointerEnd);
      node.addEventListener('click', event => {
        const dragged = suppressClick; suppressClick = false;
        if (dragged && event.detail !== 0 && !event.target.closest('button:not(#mobile-photo-location)')) {
          event.preventDefault(); event.stopImmediatePropagation();
        }
      }, true);
    });
    stage.addEventListener('click', event => {
      if (!enabled() || event.target.closest('button') || grid) return;
      const now = performance.now();
      if (lastTap !== null && now-lastTap < 280) { zoom(scale > 1 ? 1 : 2); lastTap=null; }
      else lastTap=now;
    });
    $('#mobile-photo-location').onclick=()=>setLocation(!locationOpen);
    $('#mobile-location-close').onclick=()=>setLocation(false);
    $('#mobile-photo-grid').onclick=()=>setGrid(true);
    $('#mobile-grid-back').onclick=exitToDay;
    $('#mobile-photo-back').onclick=exitToDay;
    $('#mobile-photo-prev').onclick=()=>api.move(-1);$('#mobile-photo-next').onclick=()=>api.move(1);
    dialog.addEventListener('cancel',event=>{if(!enabled())return;event.preventDefault();if(grid)setGrid(false);else if(locationOpen)setLocation(false);else back();});
    $('#mobile-back').onclick=()=>navigate('map');
    $('#mobile-open-replay').onclick=()=>api.replay();
    $('#mobile-day-picker').onclick=()=>navigate($('.atlas-shell').dataset.mobileTab==='route'?'map':'route');
    $('#mobile-previous-day').onclick=()=>{api.stepDay(-1);save();};$('#mobile-next-day').onclick=()=>{api.stepDay(1);save();};
    $('#mobile-day-details').onclick=()=>{navigate(api.scope()==='journey'?'route':'story');$('.story-panel').scrollTop=0;};
    $('#mobile-day-photos').onclick=()=>api.scope()==='journey'?api.album():openGrid(api.day().id);
    $('#mobile-story-expand').onclick=()=>navigate('map');
    $('#mobile-journey-actions').onclick=event=>{
      const action=event.target.closest('[data-journey-action]')?.dataset.journeyAction;if(!action)return;
      if(action==='overview'){navigate('map');api.overview();}
      else if(action==='photos')api.album();
      else if(action==='unlock')window.JOURNEY_ATLAS_AUTH?.showPrompt();
      else if(action==='about')$('#notes-dialog').showModal();
    };
    media.addEventListener('change',()=>{
      if (!enabled()) {setGrid(false,false);setLocation(false,false);setChrome(true);panel.inert=false;panel.removeAttribute('aria-hidden');strip.inert=false;img.style.transform='';neighbors.forEach(({node})=>node.hidden=true);if(dialog.open)api.location();}
      else if(dialog.open) {
        if(!history.state?.mobileAtlas?.viewer || !history.state.mobileAtlas.depth) {
          history.replaceState({...history.state,mobileAtlas:{...snapshot(),viewer:false,depth:0}},'',location.href);
          history.pushState({...history.state},'',location.href);viewerDepth=1;
        }
        update(current);
      }
      placeReplayPhoto();setReplayView(replayView);if(replayState)replayControlsChanged(replayState);
      renderDay();save();
    });
    window.addEventListener('resize',()=>{measure();measureReplay();});
    new ResizeObserver(()=>{ $('.map-panel').style.setProperty('--day-summary-height',`${$('.mobile-day-summary').offsetHeight}px`); }).observe($('.mobile-day-summary'));
    save();
    return {enabled,renderDay,tabChanged,update,open,closed,openGrid,exitToDay,replayControlsChanged,replayMapVisible:()=>!enabled()||replayView==='map',locationVisible:()=>locationOpen,
      fromAlbum:()=>{fromAlbum=true;},selectedDay:()=>navigate('map'),gridSelected:()=>{if(grid)setGrid(false);}, keyTarget:event=>enabled()&&(grid||event.target.closest('#photo-map'))};
  }
  const exported = {gestureAxis,swipeStep,panLimit,create};
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else root.JOURNEY_ATLAS_MOBILE = exported;
})(typeof window !== 'undefined' ? window : globalThis);
