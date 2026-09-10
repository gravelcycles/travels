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
    let gesture = null, pointers = new Map(), pinch = null, suppressedUntil = 0, busy = false, settleTimer, swipeToken = 0;
    let restoring = false, previousState = null, lastTap = 0, tapTimer, viewerDepth = 0, fromAlbum = false;
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
    function back() {
      if (history.state?.mobileAtlas?.viewer) { history.back(); return; }
      dialog.close();
    }
    function navigate(tab, push = true) {
      if (push) { save(); history.pushState({...history.state}, '', location.href); }
      api.tab(tab); save();
    }
    function renderDay() {
      const day = api.day(), info = api.dayInfo(day), index = api.days().findIndex(d => d.id === day.id);
      for (const prefix of ['mobile-day', 'mobile-story']) {
        $(`#${prefix}-date`).textContent = `Day ${day.number} · ${day.date}`;
        $(`#${prefix}-title`).textContent = day.title;
        $(`#${prefix}-meta`).textContent = prefix === 'mobile-story' ? `${info.route} · ${info.meta}` : info.meta;
      }
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
      $('#mobile-day-picker').textContent = `Day ${day.number} of ${api.days().length} ⌄`;
      $('.map-panel').style.setProperty('--day-summary-height', `${$('.mobile-day-summary').offsetHeight}px`);
      tabChanged();
    }
    function tabChanged() {
      const tab = $('.atlas-shell').dataset.mobileTab;
      $('#mobile-back span').textContent = tab === 'story' ? 'Day map' : 'All days';
      $('#mobile-back').style.visibility = tab === 'route' ? 'hidden' : '';
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
      $('#mobile-photo-zoom').textContent = scale > 1 ? '−' : '＋';
      $('#mobile-photo-zoom').setAttribute('aria-label', scale > 1 ? 'Fit whole photo' : 'Zoom into photo');
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
      viewer.style.setProperty('--reveal', `${reveal}px`);
      zoom(scale);
      $('.map-panel').style.setProperty('--day-summary-height', `${$('.mobile-day-summary').offsetHeight}px`);
    }
    function animate() {
      viewer.classList.add('is-settling'); clearTimeout(settleTimer);
      settleTimer = setTimeout(() => viewer.classList.remove('is-settling'), reduced.matches ? 0 : 360);
    }
    function revealTo(value) {
      reveal = clamp(value, 0, locationHeight); viewer.style.setProperty('--reveal', `${reveal}px`);
      viewer.dataset.locationVisible = String(reveal > 0);
    }
    function setLocation(value, record = true) {
      if (value && !current.photos.length) return;
      const changed = value !== locationOpen;
      locationOpen = value; setChrome(true); zoom(1); animate(); revealTo(value ? locationHeight : 0);
      panel.inert = !value; panel.setAttribute('aria-hidden', String(!value));
      $('#mobile-photo-location').setAttribute('aria-expanded', String(value));
      $('#mobile-photo-location .location-hint').textContent = value ? 'Back to photo' : 'Photo location';
      $('#mobile-photo-location').querySelectorAll('[aria-hidden]').forEach(el => { el.textContent = value ? '⌃' : '⌄'; });
      if (value) api.location();
      if (record && changed) { if(value) {viewerDepth++;save(true);} else history.back(); }
    }
    function setGrid(value, record = true) {
      const changed = grid !== value; grid = value; viewer.dataset.grid = String(value);
      stage.inert = value; $('.mobile-photo-header').inert = value || !chrome; $('.mobile-photo-footer').inert = value || !chrome;
      panel.inert = value || !locationOpen; $('#album-continue').inert = value || !chrome; strip.inert = !value && enabled();
      if (value) { setChrome(true); $('.mobile-photo-header').inert = true; $('.mobile-photo-footer').inert = true; $('#mobile-grid-back').focus(); }
      if (record && changed) { if(value) {viewerDepth++;save(true);} else history.back(); }
    }
    function update(data) {
      current = data; swipeToken++;
      if (!enabled()) return;
      busy = false; pointers.clear(); gesture = pinch = null; zoom(1);
      panel.inert=!locationOpen||grid;panel.setAttribute('aria-hidden',String(!locationOpen||grid));strip.inert=!grid;
      $('#mobile-photo-back span').textContent = `Day ${data.day.number}`;
      $('#mobile-photo-count').textContent = data.photos.length ? `${data.index + 1} of ${data.photos.length}` : 'No photos';
      $('#mobile-grid-title').textContent = `Day ${data.day.number} · ${data.photos.length} photos`;
      const photo = data.photos[data.index];
      $('#mobile-photo-time').textContent = photo?.takenAt || data.day.date;
      $('#mobile-photo-prev').disabled = data.index <= 0;
      $('#mobile-photo-next').disabled = data.index >= data.photos.length - 1;
      $('#mobile-photo-location').disabled = !photo;
      $('#mobile-photo-zoom').disabled = !photo;
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
        $('#mobile-photo-location').querySelectorAll('[aria-hidden]').forEach(el => { el.textContent = '⌄'; });
      }
    }
    function closed() {
      neighbors.forEach(({node}) => {api.clearImage(node);node.removeAttribute('src');});
      swipeToken++; pointers.clear(); gesture = pinch = null; busy = false; clearTimeout(tapTimer);
      if (enabled() && !restoring && history.state?.mobileAtlas?.viewer) history.go(-Math.max(1,viewerDepth));
    }
    window.addEventListener('popstate', event => {
      const state = event.state?.mobileAtlas;
      if (!enabled() || !state) return;
      const old = previousState; restoring = true;
      viewerDepth = state.depth || 0;
      const targetDay = old?.viewer && !state.viewer ? current.day?.id || state.dayId : state.dayId;
      if(api.day().id !== targetDay) api.selectDay(targetDay);
      api.tab(state.tab);
      if(!state.viewer && state.scope === 'journey' && !old?.viewer)api.overview();
      if (state.viewer) {
        if (!dialog.open || current.day?.id !== state.viewerDay) api.openDay(state.viewerDay);
        if (!(old?.viewer && old.viewerDay === state.viewerDay)) api.selectPhoto(state.index || 0);
        setLocation(state.layer === 'location', false); setGrid(state.layer === 'grid', false);
      } else if (dialog.open) {dialog.close();if(fromAlbum){fromAlbum=false;api.album();}}
      if(state.viewer && old?.layer === 'grid' && state.layer !== 'grid')$('#mobile-photo-grid').focus();
      else if(state.viewer && old?.layer === 'location' && state.layer !== 'location')$('#mobile-photo-location').focus();
      restoring = false; previousState = state;
    });
    function pointerDown(event) {
      if (!enabled() || grid || busy || event.button > 0 || event.target.closest('button:not(#mobile-photo-location)')) return;
      clearTimeout(tapTimer); viewer.classList.remove('is-settling');
      pointers.set(event.pointerId, {x:event.clientX,y:event.clientY});
      event.currentTarget.setPointerCapture(event.pointerId);
      if (pointers.size === 2) {
        const [a,b] = [...pointers.values()]; pinch = {distance:Math.hypot(a.x-b.x,a.y-b.y),scale};
        gesture = null; suppressedUntil = performance.now() + 500; return;
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
      suppressedUntil = performance.now() + 500;
      if (scale > 1 && !gesture.handle) {panX=gesture.panX+gesture.dx;panY=gesture.panY+gesture.dy;zoom(scale);return;}
      if (gesture.axis === 'x' && !gesture.handle) {
        const edge = gesture.dx > 0 ? current.index === 0 : current.index === current.photos.length-1;
        transform(gesture.dx * (edge ? .2 : 1));
      } else if (gesture.axis === 'y' && current.photos.length) {
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
        animate(); transform(delta ? -delta*(stage.clientWidth+16) : 0);
        if (delta) {busy=true;const token=++swipeToken;setTimeout(() => {if(!dialog.open||token!==swipeToken)return;viewer.classList.remove('is-settling');api.move(delta);},reduced.matches?0:260);}
      } else if (action.axis === 'y') {
        const target = cancelled ? locationOpen : action.dy < -35 ? true : action.dy > 35 ? false : reveal > locationHeight*.45;
        setLocation(target);
      }
    }
    [stage,$('#mobile-photo-location'),$('.photo-location-heading')].forEach(node => {
      node.addEventListener('pointerdown',pointerDown);node.addEventListener('pointermove',pointerMove);
      node.addEventListener('pointerup',pointerEnd);node.addEventListener('pointercancel',pointerEnd);
      node.addEventListener('click',event => {if(performance.now()<suppressedUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
    });
    stage.addEventListener('click', event => {
      if (!enabled() || event.target.closest('button') || grid) return;
      const now = performance.now();
      if (now-lastTap < 280) { clearTimeout(tapTimer); zoom(scale > 1 ? 1 : 2); lastTap=0; }
      else { lastTap=now; tapTimer=setTimeout(() => {if(!locationOpen)setChrome(!chrome);},280); }
    });
    $('#mobile-photo-location').onclick=()=>setLocation(!locationOpen);
    $('#mobile-location-close').onclick=()=>setLocation(false);
    $('#mobile-photo-grid').onclick=()=>setGrid(true);
    $('#mobile-grid-back').onclick=()=>setGrid(false);
    $('#mobile-grid-close').onclick=()=>history.go(-Math.max(1,viewerDepth));
    $('#mobile-photo-back').onclick=()=>{if(locationOpen)setLocation(false);else back();};
    $('#mobile-photo-restore').onclick=()=>setChrome(true);
    $('#mobile-photo-zoom').onclick=()=>zoom(scale>1?1:2);
    $('#mobile-photo-prev').onclick=()=>api.move(-1);$('#mobile-photo-next').onclick=()=>api.move(1);
    dialog.addEventListener('cancel',event=>{if(!enabled())return;event.preventDefault();if(grid)setGrid(false);else if(locationOpen)setLocation(false);else back();});
    $('#mobile-back').onclick=()=>navigate($('.atlas-shell').dataset.mobileTab==='story'?'map':'route');
    $('#mobile-day-picker').onclick=()=>navigate('route');
    $('#mobile-previous-day').onclick=()=>{api.stepDay(-1);save();};$('#mobile-next-day').onclick=()=>{api.stepDay(1);save();};
    $('#mobile-day-details').onclick=()=>{navigate(api.scope()==='journey'?'route':'story');$('.story-panel').scrollTop=0;};
    $('#mobile-day-photos').onclick=()=>api.scope()==='journey'?api.album():api.openDay(api.day().id);
    $('#mobile-story-expand').onclick=()=>navigate('map');
    $('#mobile-menu-open').onclick=()=>{$('[data-mobile-menu=unlock]').hidden=Boolean(window.JOURNEY_ATLAS_AUTH?.unlocked);$('#mobile-menu').showModal();};
    $('#mobile-menu').onclick=event=>{
      const action=event.target.closest('[data-mobile-menu]')?.dataset.mobileMenu;if(!action)return;
      $('#mobile-menu').close();
      if(action==='days')navigate('route');
      else if(action==='overview'){navigate('map');api.overview();}
      else if(action==='photos')api.album();
      else if(action==='unlock')window.JOURNEY_ATLAS_AUTH?.showPrompt();
      else if(action==='replay')api.replay();
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
      renderDay();save();
    });
    window.addEventListener('resize',measure);
    new ResizeObserver(()=>{ $('.map-panel').style.setProperty('--day-summary-height',`${$('.mobile-day-summary').offsetHeight}px`); }).observe($('.mobile-day-summary'));
    save();
    return {enabled,renderDay,tabChanged,update,open,closed,locationVisible:()=>locationOpen,
      fromAlbum:()=>{fromAlbum=true;},selectedDay:()=>navigate('map'),gridSelected:()=>{if(grid)setGrid(false);}, keyTarget:event=>enabled()&&(grid||event.target.closest('#photo-map'))};
  }
  const exported = {gestureAxis,swipeStep,panLimit,create};
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else root.JOURNEY_ATLAS_MOBILE = exported;
})(typeof window !== 'undefined' ? window : globalThis);
