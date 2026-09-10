(function (root) {
  "use strict";

  const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, Number(value) || 0));

  function coordinateDistance(from, to) {
    const radians = Math.PI / 180;
    const latitude1 = from[1] * radians;
    const latitude2 = to[1] * radians;
    const latitudeDelta = (to[1] - from[1]) * radians;
    const longitudeDelta = (to[0] - from[0]) * radians;
    const a = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function partialLine(coordinates, progress) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return [];
    if (coordinates.length === 1) return [coordinates[0].slice(), coordinates[0].slice()];
    const amount = clamp(progress);
    if (amount >= 1) return coordinates.map((coordinate) => coordinate.slice());

    const distances = [];
    let total = 0;
    for (let index = 1; index < coordinates.length; index += 1) {
      const distance = coordinateDistance(coordinates[index - 1], coordinates[index]);
      distances.push(distance);
      total += distance;
    }
    if (!total) return [coordinates[0].slice(), coordinates[0].slice()];

    const target = total * amount;
    const result = [coordinates[0].slice()];
    let traveled = 0;
    for (let index = 1; index < coordinates.length; index += 1) {
      const distance = distances[index - 1];
      if (traveled + distance < target) {
        result.push(coordinates[index].slice());
        traveled += distance;
        continue;
      }
      const localProgress = distance ? (target - traveled) / distance : 0;
      const from = coordinates[index - 1];
      const to = coordinates[index];
      result.push([
        from[0] + (to[0] - from[0]) * localProgress,
        from[1] + (to[1] - from[1]) * localProgress
      ]);
      break;
    }
    if (result.length === 1) result.push(result[0].slice());
    return result;
  }

  function pacedMoment(moment, journey) {
    const ids = moment.segmentIds || (moment.segmentId ? [moment.segmentId] : []);
    if (!ids.length) return { ...moment, duration: moment.duration || 2.4 };
    const legs = ids.map(id => {
      const segment = journey.segments?.find(item => item.id === id);
      const coordinates = segment?.geometry || root.JOURNEY_ATLAS_ROUTE_GEOMETRY?.[id] || [];
      const measuredKm = coordinates.slice(1).reduce((sum, point, index) => sum + coordinateDistance(coordinates[index], point) / 1000, 0);
      const km = Math.max(0, Number(segment?.distanceKm) || measuredKm);
      // Give long crossings more time, with a readable minimum for short links.
      const travel = Math.max(2.4, 1.8 + Math.sqrt(km) * 0.7, km / 12);
      return { id, settle: 0.7, travel, arrival: 0.25 };
    });
    const travelDuration = legs.reduce((sum, leg) => sum + leg.settle + leg.travel + leg.arrival, 0);
    const duration = Math.max(Number(moment.duration) || 0, travelDuration + (moment.curated ? 1.2 : 0));
    // Longer editorial durations slow travel too, rather than adding a long idle tail.
    const scale = (duration - (moment.curated ? 1.2 : 0)) / travelDuration;
    return { ...moment, duration, legTiming: legs.map(leg => ({ ...leg, travel: leg.travel * scale, settle: leg.settle * scale, arrival: leg.arrival * scale })) };
  }

  function createTimeline(journey) {
    if (journey.replayMoments?.length) return journey.replayMoments.map(moment => {
      const { photoId, ...chapter } = moment;
      return pacedMoment({ ...chapter, curated:true, type:'chapter', segmentIds:(moment.segmentIds || []).filter(id => journey.days.find(d => d.id === moment.dayId)?.segmentIds.includes(id)) }, journey);
    });
    const segmentIds = new Set((journey.segments || []).map((segment) => segment.id));
    return (journey.days || []).flatMap((day) => {
      const moments = (day.segmentIds || [])
        .filter((segmentId) => segmentIds.has(segmentId))
        .map((segmentId) => ({ id: `${day.id}:segment:${segmentId}`, type: "segment", dayId: day.id, segmentId }));
      if (!moments.length) moments.push({ id: `${day.id}:day`, type: "day", dayId: day.id });
      return moments;
    }).map(moment => pacedMoment(moment, journey));
  }

  function firstMomentIndexForDay(timeline, dayId) {
    return Math.max(0, timeline.findIndex((moment) => moment.dayId === dayId));
  }

  function initialMomentProgress(moment, reducedMotion) {
    return (moment?.type === "segment" || moment?.segmentIds?.length) && !reducedMotion ? 0 : 1;
  }

  function routePhase(moment, progress) {
    const ids = moment?.segmentIds || (moment?.segmentId ? [moment.segmentId] : []);
    if (!ids.length) return {segmentId:null,completed:[],progress:1};
    if (moment.legTiming?.length) {
      let elapsed = clamp(progress) * moment.duration;
      for (let index = 0; index < moment.legTiming.length; index += 1) {
        const leg = moment.legTiming[index];
        const duration = leg.settle + leg.travel + leg.arrival;
        if (elapsed < duration || index === moment.legTiming.length - 1) {
          const amount = clamp((elapsed - leg.settle) / leg.travel);
          // Gentle acceleration/deceleration without a jarring stop at each endpoint.
          const eased = amount * amount * (3 - 2 * amount);
          return { segmentId: leg.id, completed: ids.slice(0, index), progress: eased };
        }
        elapsed -= duration;
      }
    }
    // Curated scenes leave the last third for the day story after travel.
    const travel = clamp(progress / (moment.curated ? 0.65 : 1));
    const index = Math.min(ids.length-1, Math.floor(travel*ids.length));
    return { segmentId:ids[index], completed:ids.slice(0,index), progress:travel===1?1:travel*ids.length-index };
  }

  root.JOURNEY_ATLAS_REPLAY = {
    routePhase,
    clamp,
    coordinateDistance,
    createTimeline,
    firstMomentIndexForDay,
    initialMomentProgress,
    partialLine
  };
})(typeof globalThis === "undefined" ? this : globalThis);
