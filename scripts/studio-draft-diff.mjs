const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const title = value => value?.sourceFilename || value?.name || value?.title || value?.label || value?.caption || value?.id || '';
const labels = {
  text:'Day story', description:'Notes', caption:'Caption', alt:'Image description', title:'Title', date:'Display date',
  dayId:'Journey day', locationLabel:'Exact place', location:'Photo location', zoom:'Map zoom', mapFrame:'Map frame',
  leadPhotoId:'Lead photo', photoOrder:'Album order', trashed:'Trash', reviewed:'Review status',
  locationStatus:'Location review', privacyStatus:'Privacy review', geometry:'Route line', controlPoints:'Drawing anchors',
  routing:'Route method', source:'Route source', smoothing:'Line smoothing', smoothed:'Line smoothing',
  startDate:'Start date', endDate:'End date', timeZone:'Time zone', coverPhoto:'Cover photo', photoId:'Photo',
  replayMoments:'Replay chapters', routeGroups:'Travel groups', groupIds:'Travel groups', travelerIds:'Travelers',
  segmentIds:'Travel legs', destinationId:'Destination', placeId:'Place', durationMinutes:'Travel time (minutes)',
  distanceKm:'Distance (km)', calendarDate:'Calendar date', from:'From', to:'To', camera:'Map view',
  lat:'Latitude', lng:'Longitude', center:'Map center', objectPosition:'Crop position', order:'Order',
};
const label = key => labels[key] || String(key).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase());
const textFields = new Set(['text','description','caption','alt','locationLabel','subtitle']);
const atomic = new Set(['location','geometry','controlPoints','mapFrame','center','routing','source']);
const references = new Set(['dayId','leadPhotoId','photoId','placeId','destinationId','from','to']);
const collections = {days:'Day',photos:'Photo',segments:'Route',places:'Place',replayMoments:'Replay chapter',travelers:'Traveler',routeGroups:'Travel group',videos:'Video'};

export function studioDraftDiff(data, saved, draft, routes = {}) {
  const changes=[];
  const plans=new Map(draft.plans || []);
  const dayName = day => day ? `Day ${day.number} · ${day.title || day.date || 'Untitled day'}` : 'Unassigned day';
  function reference(id, journey, editorial=saved) {
    for (const kind of Object.keys(collections)) {
      const item=journey?.[kind]?.find(item=>item.id===id);
      if (item) return kind==='days'?dayName({...item,...editorial.days?.[id]}):kind==='segments'?routeName(item,journey):title(item);
    }
    return id;
  }
  function routeName(route, journey) {
    return route.title || route.label || `${reference(route.from,journey) || 'Start'} → ${reference(route.to,journey) || 'Destination'}`;
  }
  function context(journey, kind='trip', item=journey) {
    const photoDay=kind==='photos'?journey?.days?.find(day=>day.id===(saved.photos?.[item.id]?.dayId || item.dayId)):null;
    const savedDay=kind==='days'?{...item,...saved.days?.[item.id]}:item;
    return {groupId:`${journey?.id || item?.id}:${kind}:${item?.id || 'new'}`,journey:journey?.title || item?.title || 'New trip',
      kind:collections[kind] || 'Trip',subject:kind==='days'?dayName(savedDay):kind==='segments'?routeName(item,journey):kind==='trip'?'Trip details':title(item),
      context:photoDay?dayName({...photoDay,...saved.days?.[photoDay.id]}):'',
      thumbnail:kind==='photos'?(item.srcset?.[0]?.src || item.src || ''):''};
  }
  function display(value, key, journey, editorial=saved) {
    if (key==='trashed') return {text:value?'In Trash':'In atlas'};
    if (value===null || value===undefined || value==='') return {text:key==='mapFrame'?'Automatic frame':key==='leadPhotoId'?'Automatic lead photo':key==='location'?'No location':'Empty',empty:true};
    if (key==='location' && object(value)) return {text:`${value.lat}° latitude, ${value.lng}° longitude`};
    if (key==='geometry' || key==='controlPoints') return {text:`${value.length || 0} ${key==='geometry'?'route points':'drawing anchors'}`,details:JSON.stringify(value,null,2)};
    if (key==='mapFrame') return {text:'Custom map frame',details:JSON.stringify(value,null,2)};
    if (key==='center' && Array.isArray(value)) return {text:`${value[1]}° latitude, ${value[0]}° longitude`};
    if ((key==='routing' || key==='source') && object(value)) return {text:label(value.kind || value.name || value.type || 'Custom route'),details:JSON.stringify(value,null,2)};
    if (Array.isArray(value) && value.every(v=>typeof v==='string')) return {text:value.length?value.map((v,i)=>`${i+1}. ${reference(v,journey,editorial)}`).join('\n'):'None'};
    if (typeof value==='boolean') return {text:key==='reviewed'?(value?'Reviewed':'Not reviewed'):(value?'Yes':'No')};
    if (typeof value==='string') return {text:references.has(key)?reference(value,journey,editorial):value};
    if (object(value) || Array.isArray(value)) {
      // Added/removed objects stay readable; full data remains available on demand.
      return {text:title(value) || (Array.isArray(value)?`${value.length} items`:'Custom settings'),details:JSON.stringify(value,null,2)};
    }
    return {text:String(value)};
  }
  function compare(section, ctx, path, before, after, journey) {
    const key=path.at(-1);
    if (textFields.has(key)) { before ??= ''; after ??= ''; }
    else { before ??= null; after ??= null; }
    if (equal(before,after)) return;
    if (!atomic.has(key) && ((object(before) && object(after)) || (['coverPhoto','camera','meetup'].includes(key) && (object(before) || object(after))))) {
      for (const field of new Set([...Object.keys(before || {}),...Object.keys(after || {})])) {
        if (field!=='updatedAt' && field!=='id') compare(section,ctx,[...path,field],before?.[field],after?.[field],journey);
      }
      return;
    }
    if (Array.isArray(before) && Array.isArray(after) && [...before,...after].every(item=>object(item) && item.id)) {
      const oldIds=before.map(item=>item.id),newIds=after.map(item=>item.id);
      if (oldIds.length===newIds.length && oldIds.every(id=>newIds.includes(id)) && !equal(oldIds,newIds)) compare(section,ctx,[...path,'order'],oldIds,newIds,journey);
      for (const id of new Set([...oldIds,...newIds])) {
        const old=before.find(item=>item.id===id),next=after.find(item=>item.id===id);
        const itemCtx=collections[key]?context(journey,key,old || next):ctx;
        compare(section,itemCtx,collections[key]?[]:[...path,title(old || next)],old,next,journey);
      }
      return;
    }
    const field=path.length?path.map(label).join(' · '):before===null?'Added':after===null?'Removed':'Details';
    const nextJourney=plans.get(journey?.id)?.draft || journey;
    changes.push({section,label:`${ctx.journey} / ${ctx.subject} / ${field}`,...ctx,field,before,after,
      displayBefore:display(before,key,journey),displayAfter:display(after,key,nextJourney,draft.state || saved),
      textDiff:typeof before==='string' && typeof after==='string' && ['title','subtitle','text','caption','description','alt','locationLabel'].includes(key)});
  }
  for (const kind of ['days','photos','routes']) {
    const section={days:'Day copy',photos:'Photos',routes:'Routes'}[kind];
    for (const id of new Set([...Object.keys(saved[kind] || {}),...Object.keys(draft.state?.[kind] || {})])) {
      const field=kind==='routes'?'segments':kind;
      const journey=data.journeys.find(j=>j[field]?.some(item=>item.id===id));
      const base=journey?.[field]?.find(item=>item.id===id) || {id};
      const before=saved[kind]?.[id] || {},after=draft.state?.[kind]?.[id] || {};
      const fallback=key=>key==='location' ? (Number.isFinite(base.lat)&&Number.isFinite(base.lng)?{lat:base.lat,lng:base.lng}:null)
        : key==='geometry' ? (base.geometry || routes[id]) : key==='trashed'?Boolean(base.trashed):base[key];
      for (const key of new Set([...Object.keys(before),...Object.keys(after)])) {
        if (key==='updatedAt' || key==='hidden') continue;
        compare(section,context(journey,field,base),[key],Object.hasOwn(before,key)?before[key]:fallback(key),Object.hasOwn(after,key)?after[key]:fallback(key),journey);
      }
    }
  }
  for (const [id,plan] of draft.plans || []) {
    const journey=data.journeys.find(j=>j.id===id);
    if (!journey) { compare('Trip plan',context(plan.draft),[],null,plan.draft,plan.draft); continue; }
    for (const key of ['title','subtitle','startDate','endDate','timeZone','places','segments','days','coverPhoto','replayMoments','travelers','routeGroups','meetup','videos']) {
      compare('Trip plan',context(journey),[key],journey[key],plan.draft[key],journey);
    }
    for (const photo of plan.draft.photos || []) {
      const base=journey.photos.find(item=>item.id===photo.id);
      compare('Trip plan',context(journey,'photos',base || photo),['groupIds'],base?.groupIds,photo.groupIds,journey);
    }
  }
  return changes;
}
