const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const title = value => value?.name || value?.title || value?.label || value?.caption || value?.id || '';

export function studioDraftDiff(data, saved, draft, routes = {}) {
  const changes=[];
  function compare(section, label, before, after) {
    if (equal(before,after)) return;
    if (object(before) && object(after)) {
      for (const field of new Set([...Object.keys(before),...Object.keys(after)])) {
        if (field !== 'updatedAt') compare(section, `${label} / ${field}`, before[field], after[field]);
      }
      return;
    }
    if (Array.isArray(before) && Array.isArray(after) && [...before,...after].every(item=>object(item) && item.id)) {
      const oldIds=before.map(item=>item.id),newIds=after.map(item=>item.id);
      if (oldIds.length===newIds.length && oldIds.every(id=>newIds.includes(id)) && !equal(oldIds,newIds)) changes.push({section,label:`${label} / order`,before:before.map(title),after:after.map(title)});
      for (const id of new Set([...oldIds,...newIds])) {
        const old=before.find(item=>item.id===id),next=after.find(item=>item.id===id);
        compare(section,`${label} / ${title(next || old)}`,old,next);
      }
      return;
    }
    changes.push({section,label,before:before === undefined ? null : before,after:after === undefined ? null : after});
  }
  for (const kind of ['days','photos','routes']) {
    const section={days:'Day copy',photos:'Photos',routes:'Routes'}[kind];
    for (const id of new Set([...Object.keys(saved[kind] || {}),...Object.keys(draft.state?.[kind] || {})])) {
      const field=kind==='routes'?'segments':kind;
      const journey=data.journeys.find(j=>j[field].some(item=>item.id===id));
      const base=journey?.[field].find(item=>item.id===id) || {};
      const before=saved[kind]?.[id] || {},after=draft.state?.[kind]?.[id] || {};
      const fallback=key=>key==='location' ? (Number.isFinite(base.lat)&&Number.isFinite(base.lng)?{lat:base.lat,lng:base.lng}:null)
        : key==='geometry' ? (base.geometry || routes[id]) : base[key];
      const name=kind==='days'?`Day ${base.number} · ${base.title}`:title(base) || id;
      for (const key of new Set([...Object.keys(before),...Object.keys(after)])) {
        if (key==='updatedAt') continue;
        compare(section,`${journey?.title || 'Journey'} / ${name} / ${key}`,Object.hasOwn(before,key)?before[key]:fallback(key),Object.hasOwn(after,key)?after[key]:fallback(key));
      }
    }
  }
  for (const [id,plan] of draft.plans || []) {
    const savedJourney=data.journeys.find(j=>j.id===id);
    if (!savedJourney) { compare('Trip plan',id,undefined,plan.draft); continue; }
    for (const key of ['title','subtitle','startDate','endDate','timeZone','places','segments','days','coverPhoto','replayMoments','travelers','routeGroups','meetup','videos']) {
      compare('Trip plan',`${savedJourney.title} / ${key}`,savedJourney[key],plan.draft[key]);
    }
    for (const photo of plan.draft.photos || []) {
      compare('Trip plan',`${savedJourney.title} / ${title(photo)} / route groups`,savedJourney.photos.find(item=>item.id===photo.id)?.groupIds,photo.groupIds);
    }
  }
  return changes;
}
