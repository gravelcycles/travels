import crypto from 'node:crypto';
import { calendarDate, validateJourneys, validateOverrides } from './journey-content.mjs';
export const journeyRevision = journey => crypto.createHash('sha256').update(JSON.stringify(journey)).digest('hex');
const dateLabel = value => new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', timeZone:'UTC' }).format(calendarDate(value));
export function resizeCalendar(journey, startDate, endDate, alignment = 'dates') {
  const start = calendarDate(startDate), end = calendarDate(endDate), count = (end-start)/86400000+1;
  if (count < 1 || count > 366) throw new Error('Choose a range of 1–366 calendar days');
  const used = new Set(journey.days.map(d => d.id));
  const retained = new Set();
  const days = Array.from({length:count}, (_, i) => {
    const date = new Date(+start+i*86400000).toISOString().slice(0,10);
    const existing = alignment === 'itinerary' ? journey.days[i] : journey.days.find(d => d.calendarDate === date);
    if (existing) { retained.add(existing.id); return { ...existing, number:i+1, calendarDate:date, date:existing.calendarDate === date ? existing.date : dateLabel(date) }; }
    let serial = 1; while (used.has(`${journey.id}-d${serial}`)) serial++;
    const id = `${journey.id}-d${serial}`; used.add(id);
    return { id, number:i+1, calendarDate:date, date:dateLabel(date), title:'Day to plan', text:'', segmentIds:[] };
  });
  return { days, removed:journey.days.filter(d => !retained.has(d.id)), added:days.filter(d => !journey.days.some(old => old.id === d.id)) };
}
export function prepareJourneyPlan(data, base, changes, state, alignment = 'dates') {
  const allowed = ['title','startDate','endDate','timeZone','places','segments','days','coverPhoto','replayMoments','subtitle'];
  for (const key of Object.keys(changes)) if (!allowed.includes(key)) throw new Error(`Cannot change ${key} in the planner`);
  let journey = { ...structuredClone(base), ...structuredClone(changes) };
  if (typeof journey.title !== 'string' || !journey.title.trim() || journey.title.length > 160) throw new Error('Trip title must contain 1–160 characters');
  journey.title = journey.title.trim(); if(journey.title !== base.title) journey.label = journey.title;
  new Intl.DateTimeFormat('en', {timeZone:journey.timeZone || 'UTC'});
  let added = [], removed = [];
  if (journey.startDate !== base.startDate || journey.endDate !== base.endDate) {
    const result = resizeCalendar(journey, journey.startDate, journey.endDate, alignment);
    ({added, removed} = result); journey.days = result.days;
  }
  // A second preview/save may already contain the reconciled calendar.
  removed = base.days.filter(d => !journey.days.some(next => next.id === d.id));
  for (const s of base.segments) if (!journey.segments.some(next => next.id === s.id)) throw new Error(`Cannot remove an existing travel leg: ${s.id}`);
  for (const p of base.places) if (!journey.places.some(next => next.id === p.id)) throw new Error(`Cannot remove an existing place: ${p.id}`);
  // No silent deletion of notes, route/photo associations or editorial overrides.
  for (const day of removed) {
    if (day.text?.trim() || day.title !== 'Day to plan' || day.segmentIds.length || state.days[day.id] || base.photos.some(p => (state.photos[p.id]?.dayId || p.dayId) === day.id) || base.replayMoments?.some(m => m.dayId === day.id)) throw new Error(`Day ${day.number} (${day.calendarDate}) has content. Keep it in the date range, or move the itinerary before shortening the trip.`);
  }
  if (journey.startDate !== base.startDate || journey.endDate !== base.endDate) journey.dates = `${journey.startDate} – ${journey.endDate}`;
  if (journey.replayMoments) journey.replayMoments = journey.replayMoments.map(moment => {
    const order=journey.days.find(d=>d.id===moment.dayId)?.segmentIds || [];
    return moment.segmentIds ? {...moment,segmentIds:[...moment.segmentIds].sort((a,b)=>order.indexOf(a)-order.indexOf(b))} : moment;
  });
  const nextState = structuredClone(state);
  for (const oldDay of base.days) {
    const nextDay=journey.days.find(d=>d.id===oldDay.id);
    if(nextDay && oldDay.calendarDate !== nextDay.calendarDate && nextState.days[oldDay.id]?.date === oldDay.date) nextState.days[oldDay.id].date=nextDay.date;
  }
  const next = { ...data, journeys:data.journeys.map(j => j.id === base.id ? journey : j) };
  validateJourneys(next); validateOverrides(nextState, next);
  return { journey, state:nextState, added:added.map(d => d.calendarDate), removed:removed.map(d => d.calendarDate) };
}
