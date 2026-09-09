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

  function orderedDayPhotos(journey, day) {
    const photos = (journey.photos || []).filter((photo) => photo.dayId === day.id && !photo.hidden);
    const order = day.photoOrder || [];
    const positions = new Map(order.map((id, index) => [id, index]));
    return photos.map((photo, index) => ({ photo, index })).sort((first, second) => {
      const firstPosition = positions.has(first.photo.id) ? positions.get(first.photo.id) : order.length + first.index;
      const secondPosition = positions.has(second.photo.id) ? positions.get(second.photo.id) : order.length + second.index;
      return firstPosition - secondPosition || first.index - second.index;
    }).map(({ photo }) => photo);
  }

  function createTimeline(journey) {
    if (journey.replayMoments?.length) return journey.replayMoments.map(moment => {
      const photo = journey.photos?.find(p => p.id === moment.photoId && !p.hidden && p.dayId === moment.dayId);
      return { ...moment, curated:true, type:'chapter', photoId:photo?.id, segmentIds:(moment.segmentIds || []).filter(id => journey.days.find(d => d.id === moment.dayId)?.segmentIds.includes(id)) };
    });
    const segmentIds = new Set((journey.segments || []).map((segment) => segment.id));
    return (journey.days || []).flatMap((day) => {
      const moments = (day.segmentIds || [])
        .filter((segmentId) => segmentIds.has(segmentId))
        .map((segmentId) => ({ id: `${day.id}:segment:${segmentId}`, type: "segment", dayId: day.id, segmentId }));
      orderedDayPhotos(journey, day)
        .filter((photo) => Number.isFinite(photo.lng) && Number.isFinite(photo.lat))
        .forEach((photo) => moments.push({ id: `${day.id}:photo:${photo.id}`, type: "photo", dayId: day.id, photoId: photo.id }));
      if (!moments.length) moments.push({ id: `${day.id}:day`, type: "day", dayId: day.id });
      return moments;
    });
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
    // Curated scenes leave the last third for the photograph/text after travel.
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
