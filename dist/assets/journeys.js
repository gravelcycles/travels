/*
  Journey Atlas content lives here.

  Each journey is organized by days, not nights or transport legs. A day can:
  - stay in one place (segmentIds: [])
  - travel from one place to another
  - loop back to a base
  - combine several ordered segments and transport modes

  A segment can include `via` latitude/longitude pairs. The day close-up uses
  every point in order, so detailed legs follow the route rather than drawing
  only from their start to end.

  Photos belong to a day through dayId. They may also have exact GPS coordinates,
  EXIF time, tags, and OCR text. Photo src values can be local paths or HTTPS URLs.
*/
window.JOURNEY_ATLAS_DATA = {
  defaultJourneyId: "switzerland-italy-family-2026",
  journeys: [
    {
      id: "switzerland-italy-family-2026",
      badge: "FAMILY JOURNEY",
      label: "Switzerland & Italy · Family trip",
      title: "Lakes, Rails & Rain",
      subtitle: "Two family weeks based in Luzern, with mountain days and a rainy turn through Como",
      kicker: "FAMILY JOURNEY · SWITZERLAND + ITALY",
      dates: "13–26 August 2026",
      note: "David and Michelle traveled with her parents, using Luzern as home base except for three nights around Como.",
      cover: "./assets/photos/train-window.webp",
      places: [
        { id: "zurich-flughafen", name: "Zürich Flughafen", country: "Switzerland", lat: 47.4582, lng: 8.5555 },
        { id: "luzern", name: "Luzern", country: "Switzerland", lat: 47.0502, lng: 8.3093 },
        { id: "engelberg", name: "Engelberg", country: "Switzerland", lat: 46.821, lng: 8.402 },
        { id: "bern", name: "Bern", country: "Switzerland", lat: 46.948, lng: 7.4474 },
        { id: "kehrsiten", name: "Kehrsiten-Bürgenstock", country: "Switzerland", lat: 46.9939, lng: 8.3725 },
        { id: "brienz", name: "Brienz", country: "Switzerland", lat: 46.7541, lng: 8.0395 },
        { id: "interlaken-ost", name: "Interlaken Ost", country: "Switzerland", lat: 46.6905, lng: 7.8694 },
        { id: "lauterbrunnen", name: "Lauterbrunnen", country: "Switzerland", lat: 46.5982, lng: 7.907 },
        { id: "grutschalp", name: "Grütschalp", country: "Switzerland", lat: 46.5962, lng: 7.8908 },
        { id: "murren", name: "Mürren", country: "Switzerland", lat: 46.5596, lng: 7.8926 },
        { id: "como-family", name: "Como", country: "Italy", lat: 45.8081, lng: 9.0852 },
        { id: "varenna-family", name: "Varenna", country: "Italy", lat: 46.0109, lng: 9.2837 },
        { id: "fiumelatte", name: "Fiumelatte", country: "Italy", lat: 46.0008, lng: 9.2925 },
        { id: "dervio", name: "Dervio", country: "Italy", lat: 46.0764, lng: 9.3051 },
        { id: "bellano", name: "Bellano", country: "Italy", lat: 46.0435, lng: 9.3054 },
        { id: "lugano", name: "Lugano", country: "Switzerland", lat: 46.005, lng: 8.951 },
        { id: "kriens", name: "Kriens", country: "Switzerland", lat: 47.0343, lng: 8.2797 },
        { id: "pilatus-kulm", name: "Pilatus Kulm", country: "Switzerland", lat: 46.9794, lng: 8.2542 },
        { id: "alpnachstad", name: "Alpnachstad", country: "Switzerland", lat: 46.9558, lng: 8.2772 }
      ],
      segments: [
        { id: "family-airport-luzern", from: "zurich-flughafen", to: "luzern", mode: "train", distanceKm: 68, duration: "1 hr 10", via: [[47.412, 8.544], [47.3782, 8.5402], [47.172, 8.516], [47.142, 8.431]] },
        { id: "family-luzern-engelberg", from: "luzern", to: "engelberg", mode: "train", distanceKm: 35, duration: "43 min", via: [[46.9903, 8.3099], [46.9581, 8.3656], [46.9077, 8.3945]] },
        { id: "family-engelberg-luzern", from: "engelberg", to: "luzern", mode: "train", distanceKm: 35, duration: "43 min", via: [[46.9077, 8.3945], [46.9581, 8.3656], [46.9903, 8.3099]] },
        { id: "family-luzern-bern", from: "luzern", to: "bern", mode: "train", distanceKm: 110, duration: "1 hr 05", via: [[47.171, 8.108], [47.288, 7.945], [47.351, 7.907]] },
        { id: "family-bern-luzern", from: "bern", to: "luzern", mode: "train", distanceKm: 110, duration: "1 hr 05", via: [[47.351, 7.907], [47.288, 7.945], [47.171, 8.108]] },
        { id: "family-luzern-kehrsiten-bike", from: "luzern", to: "kehrsiten", mode: "bike", distanceKm: 25, duration: "2–3 hrs with stops", via: [[47.0182, 8.3096], [46.9903, 8.3099], [46.9768, 8.337], [46.9868, 8.354]] },
        { id: "family-kehrsiten-luzern-boat", from: "kehrsiten", to: "luzern", mode: "boat", distanceKm: 11, duration: "55 min", via: [[47.0008, 8.358], [47.0185, 8.342], [47.037, 8.323]] },
        { id: "family-luzern-brienz", from: "luzern", to: "brienz", mode: "train", distanceKm: 62, duration: "1 hr 30", via: [[46.895, 8.245], [46.779, 8.159], [46.727, 8.184], [46.732, 8.053]] },
        { id: "family-brienz-interlaken-boat", from: "brienz", to: "interlaken-ost", mode: "boat", distanceKm: 18, duration: "1 hr 15", via: [[46.742, 8.006], [46.724, 7.951], [46.704, 7.902]] },
        { id: "family-interlaken-lauterbrunnen", from: "interlaken-ost", to: "lauterbrunnen", mode: "train", distanceKm: 13, duration: "20 min", via: [[46.663, 7.87], [46.632, 7.899]] },
        { id: "family-lauterbrunnen-grutschalp", from: "lauterbrunnen", to: "grutschalp", mode: "gondola", distanceKm: 1.5, duration: "4 min", via: [[46.597, 7.9]] },
        { id: "family-grutschalp-murren", from: "grutschalp", to: "murren", mode: "train", distanceKm: 4, duration: "14 min", via: [[46.582, 7.896], [46.573, 7.895]] },
        { id: "family-murren-grutschalp", from: "murren", to: "grutschalp", mode: "train", distanceKm: 4, duration: "14 min", via: [[46.573, 7.895], [46.582, 7.896]] },
        { id: "family-grutschalp-lauterbrunnen", from: "grutschalp", to: "lauterbrunnen", mode: "gondola", distanceKm: 1.5, duration: "4 min", via: [[46.597, 7.9]] },
        { id: "family-lauterbrunnen-interlaken", from: "lauterbrunnen", to: "interlaken-ost", mode: "train", distanceKm: 13, duration: "20 min", via: [[46.632, 7.899], [46.663, 7.87]] },
        { id: "family-interlaken-luzern", from: "interlaken-ost", to: "luzern", mode: "train", distanceKm: 74, duration: "1 hr 50", via: [[46.706, 7.962], [46.732, 8.053], [46.727, 8.184], [46.779, 8.159], [46.895, 8.245]] },
        { id: "family-luzern-como", from: "luzern", to: "como-family", mode: "train", distanceKm: 195, duration: "2 hr 50", via: [[47.05, 8.55], [46.875, 8.63], [46.528, 8.608], [46.195, 9.029], [46.005, 8.951], [45.833, 9.032]] },
        { id: "family-como-varenna-boat", from: "como-family", to: "varenna-family", mode: "boat", distanceKm: 29, duration: "2 hrs", via: [[45.857, 9.105], [45.916, 9.133], [45.969, 9.202], [45.994, 9.257]] },
        { id: "family-varenna-fiumelatte", from: "varenna-family", to: "fiumelatte", mode: "walk", distanceKm: 3, duration: "45 min", via: [[46.006, 9.286], [46.003, 9.289]] },
        { id: "family-fiumelatte-dervio", from: "fiumelatte", to: "dervio", mode: "train", distanceKm: 12, duration: "20 min", via: [[46.0435, 9.3054], [46.062, 9.307]] },
        { id: "family-dervio-bellano-boat", from: "dervio", to: "bellano", mode: "boat", distanceKm: 5, duration: "25 min", via: [[46.065, 9.292], [46.052, 9.296]] },
        { id: "family-bellano-como-bus", from: "bellano", to: "como-family", mode: "bus", distanceKm: 56, duration: "1 hr 45", via: [[46.01, 9.30], [45.8566, 9.3977], [45.81, 9.227]] },
        { id: "family-como-lugano", from: "como-family", to: "lugano", mode: "train", distanceKm: 34, duration: "45 min", via: [[45.833, 9.032], [45.853, 9.031], [45.982, 8.933]] },
        { id: "family-lugano-luzern", from: "lugano", to: "luzern", mode: "train", distanceKm: 170, duration: "2 hrs", via: [[46.195, 9.029], [46.528, 8.608], [46.665, 8.589], [46.875, 8.63], [47.05, 8.55]] },
        { id: "family-luzern-kriens", from: "luzern", to: "kriens", mode: "bus", distanceKm: 5, duration: "20 min", via: [[47.044, 8.297], [47.039, 8.286]] },
        { id: "family-kriens-pilatus", from: "kriens", to: "pilatus-kulm", mode: "gondola", distanceKm: 6, duration: "35 min", via: [[47.017, 8.258], [46.996, 8.253], [46.985, 8.253]] },
        { id: "family-pilatus-alpnachstad", from: "pilatus-kulm", to: "alpnachstad", mode: "train", distanceKm: 5, duration: "30 min", via: [[46.974, 8.26], [46.966, 8.267]] },
        { id: "family-alpnachstad-luzern", from: "alpnachstad", to: "luzern", mode: "train", distanceKm: 15, duration: "20 min", via: [[46.9903, 8.3099], [47.0182, 8.3096]] },
        { id: "family-luzern-airport", from: "luzern", to: "zurich-flughafen", mode: "train", distanceKm: 68, duration: "1 hr 10", via: [[47.142, 8.431], [47.172, 8.516], [47.3782, 8.5402], [47.412, 8.544]] }
      ],
      days: [
        { id: "family-d1", number: 1, date: "13 Aug", title: "The family arrives", placeId: "luzern", segmentIds: ["family-airport-luzern"], text: "David and Michelle took the train to Zürich Flughafen, collected her parents, and brought everyone back to the Luzern base. A home-cooked dinner made the arrival feel settled, followed by a first nighttime walk through the old center and along the river.", highlights: [{ icon: "✈️", label: "Airport pickup", lat: 47.4582, lng: 8.5555 }, { icon: "🍳", label: "Cooked dinner together", lat: 47.0502, lng: 8.3093 }, { icon: "🌙", label: "Night walk through downtown Luzern", lat: 47.052, lng: 8.306 }] },
        { id: "family-d2", number: 2, date: "14 Aug", title: "Water and waterfalls in Engelberg", placeId: "luzern", segmentIds: ["family-luzern-engelberg", "family-engelberg-luzern"], text: "The train climbed from Luzern into Engelberg for a day that mixed cold water, an easy lunch, and a walk toward the waterfall. Dad also supplied the trip's most unforgettable line—he “blew his nutsack”—which entered the family record exactly as delivered.", highlights: [{ icon: "🏊", label: "A dip in the lake", lat: 46.817, lng: 8.397 }, { icon: "💧", label: "Waterfall walk", lat: 46.823, lng: 8.421 }, { icon: "💥", label: "Dad's immortal trip quote", lat: 46.821, lng: 8.402 }] },
        { id: "family-d3", number: 3, date: "15 Aug", title: "Bern, bears and the Aare", placeId: "luzern", segmentIds: ["family-luzern-bern", "family-bern-luzern"], text: "With Luzern quiet for the Feast of the Assumption, the family made Bern the day's destination. Free gelato led into lunch, a float on the Aare, a long old-town walk, and a visit to the bears before mussels closed out a very full day.", highlights: [{ icon: "🍨", label: "Free gelato", lat: 46.9485, lng: 7.451 }, { icon: "🛟", label: "Floating the Aare", lat: 46.942, lng: 7.452 }, { icon: "🐻", label: "The bears at BärenPark", lat: 46.948, lng: 7.459 }, { icon: "🦪", label: "Mussels for dinner", lat: 46.949, lng: 7.445 }] },
        { id: "family-d4", number: 4, date: "16 Aug", title: "By bicycle, cliff and ferry", placeId: "luzern", segmentIds: ["family-luzern-kehrsiten-bike", "family-kehrsiten-luzern-boat"], text: "Bicycles turned the lake into the day's route: a picnic and swim broke up the ride before the group continued to Kehrsiten. A cliff jump and the climb back up to the ferry gave the afternoon its edge; the boat carried everyone home, and Abi's dinner was eaten on a bench overlooking the Reuss and the covered bridge.", highlights: [{ icon: "🚲", label: "Lake ride", lat: 47.0182, lng: 8.3096 }, { icon: "🧺", label: "Picnic and swim", lat: 46.9903, lng: 8.31 }, { icon: "🧗", label: "Cliff jump and climb to the ferry", lat: 46.9939, lng: 8.3725 }, { icon: "🥡", label: "Abi's dinner above the Reuss", lat: 47.051, lng: 8.305 }] },
        { id: "family-d5", number: 5, date: "17 Aug", title: "Rain against the windows", placeId: "luzern", segmentIds: [], text: "Rain made the decision for everyone and turned the Luzern base into a proper rest day. David and Michelle watched The Odyssey while the weather worked its way across the lake outside.", highlights: [{ icon: "☔", label: "Rain day in Luzern", lat: 47.0502, lng: 8.3093 }, { icon: "🎬", label: "David and Michelle watched The Odyssey", lat: 47.0508, lng: 8.31 }] },
        { id: "family-d6", number: 6, date: "18 Aug", title: "Every kind of mountain connection", placeId: "luzern", segmentIds: ["family-luzern-brienz", "family-brienz-interlaken-boat", "family-interlaken-lauterbrunnen", "family-lauterbrunnen-grutschalp", "family-grutschalp-murren", "family-murren-grutschalp", "family-grutschalp-lauterbrunnen", "family-lauterbrunnen-interlaken", "family-interlaken-luzern"], text: "This was the grand connection day: train to Brienz, boat across the lake to Interlaken, train into Lauterbrunnen, gondola to Grütschalp, and the little mountain railway to Mürren. The return retraced the high section before continuing by rail from Interlaken to Luzern, a full loop made from nine ordered legs.", highlights: [{ icon: "⛴️", label: "Boat across Lake Brienz", lat: 46.724, lng: 7.951 }, { icon: "💦", label: "Lauterbrunnen valley", lat: 46.5982, lng: 7.907 }, { icon: "🚡", label: "Gondola to Grütschalp", lat: 46.5968, lng: 7.897 }, { icon: "🏔️", label: "Mürren above the valley", lat: 46.5596, lng: 7.8926 }] },
        { id: "family-d7", number: 7, date: "19 Aug", title: "Brockies, river and castle", placeId: "luzern", segmentIds: [], text: "A local Luzern day began with brockies and the pleasure of browsing without a timetable. Later came a float on the Reuss and a castle visit—the kind of day that made the city feel less like a stop and more like home base.", highlights: [{ icon: "🧥", label: "Brockies", lat: 47.047, lng: 8.305 }, { icon: "🛟", label: "Float on the Reuss", lat: 47.052, lng: 8.298 }, { icon: "🏰", label: "Castle visit", lat: 47.06, lng: 8.302 }] },
        { id: "family-d8", number: 8, date: "20 Aug", title: "South through the rain", placeId: "como-family", segmentIds: ["family-luzern-como"], text: "The family packed up the Luzern base for a rainy rail day south to Como. The long line through the Gotthard corridor carried the trip from central Switzerland into Ticino and across the Italian border, with lake weather waiting at the other end.", highlights: [{ icon: "☔", label: "Rain all the way south", lat: 46.528, lng: 8.608 }, { icon: "🇮🇹", label: "Arrival in Como", lat: 45.8081, lng: 9.0852 }] },
        { id: "family-d9", number: 9, date: "21 Aug", title: "Cards while Como rained", placeId: "como-family", segmentIds: [], text: "Como stayed rainy, so the pace dropped to cards and rounds of spades indoors. In the evening everyone traded the grey lakefront for the warmth of an Italian trattoria and a dinner worth going out into the weather for.", highlights: [{ icon: "🃏", label: "Cards and spades", lat: 45.8081, lng: 9.0852 }, { icon: "🍝", label: "Dinner at an Italian trattoria", lat: 45.811, lng: 9.083 }] },
        { id: "family-d10", number: 10, date: "22 Aug", title: "Five legs around Lake Como", placeId: "como-family", segmentIds: ["family-como-varenna-boat", "family-varenna-fiumelatte", "family-fiumelatte-dervio", "family-dervio-bellano-boat", "family-bellano-como-bus"], text: "Lake Como finally became the route itself. A ferry reached Varenna, the family walked on to Fiumelatte, caught the train to Dervio, crossed by boat to Bellano, and took the bus back to Como—five distinct legs stitched into one close-up map.", highlights: [{ icon: "⛴️", label: "Ferry to Varenna", lat: 45.969, lng: 9.202 }, { icon: "💧", label: "Walk to Fiumelatte", lat: 46.0008, lng: 9.2925 }, { icon: "🚤", label: "Boat to Bellano", lat: 46.052, lng: 9.296 }, { icon: "🚌", label: "Bus back to Como", lat: 45.8566, lng: 9.3977 }] },
        { id: "family-d11", number: 11, date: "23 Aug", title: "North again, by way of Lugano", placeId: "luzern", segmentIds: ["family-como-lugano", "family-lugano-luzern"], text: "The return to Luzern was split by a stop in Lugano, keeping the travel day from becoming only transit. After a pause beside another lake, the train continued north through the Gotthard corridor and back to the familiar Luzern base.", highlights: [{ icon: "☕", label: "Lugano stopover", lat: 46.005, lng: 8.951 }, { icon: "🏠", label: "Back to the Luzern base", lat: 47.0502, lng: 8.3093 }] },
        { id: "family-d12", number: 12, date: "24 Aug", title: "Over Pilatus, not around it", placeId: "luzern", segmentIds: ["family-luzern-kriens", "family-kriens-pilatus", "family-pilatus-alpnachstad", "family-alpnachstad-luzern"], text: "A bus to Kriens opened a classic Pilatus circuit. The gondola climbed toward the summit, the mountain railway descended the opposite face to Alpnachstad, and an ordinary train completed the loop to Luzern—a compact day with four very different legs.", highlights: [{ icon: "🚡", label: "Gondola above Kriens", lat: 46.996, lng: 8.253 }, { icon: "⛰️", label: "Pilatus Kulm", lat: 46.9794, lng: 8.2542 }, { icon: "🚞", label: "Mountain railway to Alpnachstad", lat: 46.966, lng: 8.267 }] },
        { id: "family-d13", number: 13, date: "25 Aug", title: "One unhurried Luzern day", placeId: "luzern", segmentIds: [], text: "After mountain trains, ferries, bicycles, and rainy border crossings, the family left this day deliberately loose. Luzern was enough: familiar streets, the lake nearby, and no connection to catch.", highlights: [{ icon: "🧘", label: "A deliberately quiet day", lat: 47.0502, lng: 8.3093 }] },
        { id: "family-d14", number: 14, date: "26 Aug", title: "Back to Zürich Flughafen", placeId: "zurich-flughafen", segmentIds: ["family-luzern-airport"], text: "The final train carried Michelle's parents from Luzern back to Zürich Flughafen for their flight out. The same airport line that had opened the family trip now closed it, with two weeks of lakes, rain, boats, mountains, and shared meals in between.", highlights: [{ icon: "✈️", label: "Flight home", lat: 47.4582, lng: 8.5555 }] }
      ],
      photos: []
    },
    {
      id: "alpine-crossing",
      label: "Across the Alps · Mixed demo",
      title: "Across the Alps",
      subtitle: "Ten days of lake mornings, high passes and the long road north",
      kicker: "MIXED JOURNEY · SWITZERLAND TO GERMANY",
      dates: "18–27 August 2026",
      note: "A mixed journey showing travel days, quiet days in one place, and several photographs attached to a single day.",
      cover: "./assets/photos/alpine-route.webp",
      places: [
        { id: "lucerne", name: "Lucerne", country: "Switzerland", lat: 47.0502, lng: 8.3093 },
        { id: "andermatt", name: "Andermatt", country: "Switzerland", lat: 46.6356, lng: 8.5939 },
        { id: "disentis", name: "Disentis", country: "Switzerland", lat: 46.7051, lng: 8.8553 },
        { id: "st-moritz", name: "St. Moritz", country: "Switzerland", lat: 46.4908, lng: 9.8355 },
        { id: "tirano", name: "Tirano", country: "Italy", lat: 46.215, lng: 10.1673 },
        { id: "varenna", name: "Varenna", country: "Italy", lat: 46.0109, lng: 9.2837 },
        { id: "bellagio", name: "Bellagio", country: "Italy", lat: 45.9877, lng: 9.2619 },
        { id: "como", name: "Como", country: "Italy", lat: 45.8081, lng: 9.0852 },
        { id: "freiburg", name: "Freiburg", country: "Germany", lat: 47.999, lng: 7.8421 }
      ],
      segments: [
        { id: "lucerne-andermatt", from: "lucerne", to: "andermatt", mode: "train", distanceKm: 75, duration: "1 hr 50", via: [[46.835, 8.638]] },
        { id: "andermatt-disentis", from: "andermatt", to: "disentis", mode: "bike", distanceKm: 62, duration: "4–6 hrs", via: [[46.658, 8.671], [46.563, 8.8]] },
        { id: "disentis-st-moritz", from: "disentis", to: "st-moritz", mode: "train", distanceKm: 98, duration: "2 hr 25", via: [[46.775, 9.207], [46.697, 9.441]] },
        { id: "st-moritz-tirano", from: "st-moritz", to: "tirano", mode: "train", distanceKm: 61, duration: "2 hr 20", via: [[46.478, 9.917], [46.408, 10.019], [46.374, 10.03], [46.284, 10.098]] },
        { id: "tirano-varenna", from: "tirano", to: "varenna", mode: "train", distanceKm: 72, duration: "1 hr 30", via: [[46.169, 9.87], [46.135, 9.57], [46.136, 9.374]] },
        { id: "varenna-bellagio", from: "varenna", to: "bellagio", mode: "boat", distanceKm: 4, duration: "15 min", via: [[46.001, 9.274], [45.994, 9.267]] },
        { id: "bellagio-como", from: "bellagio", to: "como", mode: "bus", distanceKm: 32, duration: "1 hr 10", via: [[45.963, 9.22], [45.913, 9.157], [45.856, 9.115]] },
        { id: "como-waterfront-walk", from: "como", to: "como", mode: "walk", distanceKm: 5, duration: "1 hr 30", via: [[45.815, 9.077], [45.821, 9.074], [45.814, 9.09]] },
        { id: "como-freiburg", from: "como", to: "freiburg", mode: "car", distanceKm: 344, duration: "4 hr 35", via: [[46.51, 8.94], [47.37, 8.54]] }
      ],
      days: [
        { id: "alps-d1", number: 1, date: "18 Aug", title: "Arrival beside the lake", placeId: "lucerne", segmentIds: [], text: "We reached Lucerne late enough for the old city to feel quiet. The first evening was mostly a walk along the water and the relief of putting the bags down." },
        { id: "alps-d2", number: 2, date: "19 Aug", title: "A slow Lucerne day", placeId: "lucerne", segmentIds: [], text: "No travel today. We crossed the river several times, stopped whenever the light changed, and left the timetable folded in a pocket." },
        { id: "alps-d3", number: 3, date: "20 Aug", title: "Up the Reuss valley", placeId: "andermatt", segmentIds: ["lucerne-andermatt"], text: "The train climbed into a tighter valley with every stop. By Andermatt, the route ahead finally looked as steep as it had on the map." },
        { id: "alps-d4", number: 4, date: "21 Aug", title: "Over the pass", placeId: "disentis", segmentIds: ["andermatt-disentis"], text: "The slowest day of the trip earned the widest views. We climbed in cool air, stopped for coffee near the top, and rolled down toward Disentis with the valley opening below us." },
        { id: "alps-d5", number: 5, date: "22 Aug", title: "A full window-seat day", placeId: "st-moritz", segmentIds: ["disentis-st-moritz"], text: "A day measured in tunnels, sudden lakes and the few seconds when a village appeared perfectly framed in the window. This is the sample day with more than one photograph.", highlights: [{ icon: "🚆", label: "The best window-seat view", lat: 46.62, lng: 9.48 }] },
        { id: "alps-d6", number: 6, date: "23 Aug", title: "High-valley pause", placeId: "st-moritz", segmentIds: [], text: "We stayed in the high valley and let the route rest. The day was for short walks, weather moving over the ridges, and nowhere we had to be." },
        { id: "alps-d7", number: 7, date: "24 Aug", title: "Rails, water and the lake road", placeId: "como", segmentIds: ["st-moritz-tirano", "tirano-varenna", "varenna-bellagio", "bellagio-como"], text: "Four ordered legs made one travel day: the Bernina railway crossed into Italy, a second train reached Varenna, the boat cut across the lake to Bellagio, and the final bus followed the shore into Como. The day close-up follows the shaping points of every leg rather than connecting only St. Moritz and Como." },
        { id: "alps-d8", number: 8, date: "25 Aug", title: "Ferries and rain clouds", placeId: "como", segmentIds: ["como-waterfront-walk"], text: "A same-place day can still hold a full story. We followed the shoreline, waited out a shower under an arcade, and watched the ferries redraw the lake.", highlights: [{ icon: "☔", label: "Shelter beneath the arcade", lat: 45.811, lng: 9.083 }] },
        { id: "alps-d9", number: 9, date: "26 Aug", title: "One last Como morning", placeId: "como", segmentIds: [], text: "Breakfast stretched into late morning. We packed slowly and returned to the waterfront once more before the long drive north." },
        { id: "alps-d10", number: 10, date: "27 Aug", title: "The long road north", placeId: "freiburg", segmentIds: ["como-freiburg"], text: "The final day crossed the Alps once more, this time in a single long line. Freiburg arrived with evening light and the Black Forest just beyond the city." }
      ],
      photos: [
        { id: "pass-break", dayId: "alps-d4", src: "./assets/photos/bike-pass.webp", alt: "Loaded touring bicycle beside a mountain café", caption: "Coffee at the top of the climb", takenAt: "21 Aug · 12:14", lat: 46.64, lng: 8.61, tags: ["bike", "pass", "coffee"] },
        { id: "alpine-overlook", dayId: "alps-d5", src: "./assets/photos/alpine-route.webp", alt: "Train, road and touring cyclist sharing an alpine valley", caption: "Three ways through the same valley", takenAt: "22 Aug · 17:42", lat: 46.72, lng: 8.92, tags: ["train", "bike", "valley"] },
        { id: "window-seat", dayId: "alps-d5", src: "./assets/photos/train-window.webp", alt: "Mountain lake and village seen through a train window", caption: "The lake appeared between tunnels", takenAt: "22 Aug · 18:06", lat: 46.62, lng: 9.48, tags: ["train", "window", "lake"], ocrText: "" }
      ]
    },
    {
      id: "rail-to-adriatic",
      label: "North to the Adriatic · Rail/bus demo",
      title: "North to the Adriatic",
      subtitle: "A handful of Eurail days, with the pauses between them left intact",
      kicker: "TRAIN + BUS JOURNEY · CENTRAL EUROPE",
      dates: "September 2026",
      note: "A route made from individual rail days rather than one continuous itinerary.",
      cover: "./assets/photos/train-window.webp",
      places: [
        { id: "berlin", name: "Berlin", country: "Germany", lat: 52.52, lng: 13.405 },
        { id: "prague", name: "Prague", country: "Czechia", lat: 50.0755, lng: 14.4378 },
        { id: "vienna", name: "Vienna", country: "Austria", lat: 48.2082, lng: 16.3738 },
        { id: "ljubljana", name: "Ljubljana", country: "Slovenia", lat: 46.0569, lng: 14.5058 },
        { id: "split", name: "Split", country: "Croatia", lat: 43.5081, lng: 16.4402 }
      ],
      segments: [
        { id: "berlin-prague", from: "berlin", to: "prague", mode: "train", distanceKm: 350, duration: "4 hr 20", via: [[51.05, 13.74]] },
        { id: "prague-vienna", from: "prague", to: "vienna", mode: "train", distanceKm: 330, duration: "4 hrs" },
        { id: "vienna-ljubljana", from: "vienna", to: "ljubljana", mode: "train", distanceKm: 385, duration: "6 hrs", via: [[47.07, 15.44], [46.62, 15.64]] },
        { id: "ljubljana-split", from: "ljubljana", to: "split", mode: "bus", distanceKm: 470, duration: "7–9 hrs", via: [[45.81, 15.98], [44.12, 15.23]] }
      ],
      days: [
        { id: "adriatic-d1", number: 1, date: "3 Sep", title: "Berlin before departure", placeId: "berlin", segmentIds: [], text: "A city day before the pass began. The route exists on the map, but the journal still has room for the places where nothing moved." },
        { id: "adriatic-d2", number: 2, date: "4 Sep", title: "South along the Elbe", placeId: "prague", segmentIds: ["berlin-prague"], text: "The first Eurail day carried us south beside the river and into Prague by afternoon." },
        { id: "adriatic-d3", number: 3, date: "6 Sep", title: "Prague to Vienna", placeId: "vienna", segmentIds: ["prague-vienna"], text: "Platforms, a border crossed without ceremony, and enough daylight left for a long walk in Vienna." },
        { id: "adriatic-d4", number: 4, date: "9 Sep", title: "Across Austria", placeId: "ljubljana", segmentIds: ["vienna-ljubljana"], text: "The rail day arced through Austria and over the southern edge of the Alps." },
        { id: "adriatic-d5", number: 5, date: "12 Sep", title: "The final road south", placeId: "split", segmentIds: ["ljubljana-split"], text: "The last leg traded rails for a bus and ended where the streets opened onto the Adriatic." }
      ],
      photos: [
        { id: "rail-window-demo", dayId: "adriatic-d3", src: "./assets/photos/train-window.webp", alt: "A lake seen from a moving train", caption: "Somewhere between Prague and Vienna", takenAt: "6 Sep · 14:20", lat: 48.82, lng: 15.62, tags: ["train", "window"] }
      ]
    },
    {
      id: "dolomites-road",
      label: "Dolomites road days · Car demo",
      title: "Dolomites Road Days",
      subtitle: "Moving bases, one loop day, and room for the detours",
      kicker: "CAR JOURNEY · ALPINE ROADS",
      dates: "A four-day sample",
      note: "This sample includes a day trip that starts and ends at the same base.",
      cover: "./assets/photos/alpine-route.webp",
      places: [
        { id: "innsbruck", name: "Innsbruck", country: "Austria", lat: 47.2692, lng: 11.4041 },
        { id: "cortina", name: "Cortina d'Ampezzo", country: "Italy", lat: 46.5405, lng: 12.1357 },
        { id: "ortisei", name: "Ortisei", country: "Italy", lat: 46.5743, lng: 11.672 },
        { id: "bolzano", name: "Bolzano", country: "Italy", lat: 46.4983, lng: 11.3548 }
      ],
      segments: [
        { id: "innsbruck-cortina", from: "innsbruck", to: "cortina", mode: "car", distanceKm: 165, duration: "3–4 hrs", via: [[46.78, 11.72], [46.72, 12.22]] },
        { id: "cortina-loop", from: "cortina", to: "cortina", mode: "car", distanceKm: 95, duration: "3–5 hrs", via: [[46.52, 12.01], [46.53, 11.86], [46.57, 11.96]] },
        { id: "cortina-ortisei", from: "cortina", to: "ortisei", mode: "car", distanceKm: 85, duration: "2–3 hrs", via: [[46.55, 11.87]] },
        { id: "ortisei-seceda-loop", from: "ortisei", to: "ortisei", mode: "gondola", distanceKm: 10, duration: "40 min return", via: [[46.582, 11.69], [46.6002, 11.7246], [46.582, 11.69]] },
        { id: "ortisei-bolzano", from: "ortisei", to: "bolzano", mode: "car", distanceKm: 40, duration: "1 hr" }
      ],
      days: [
        { id: "road-d1", number: 1, date: "Day 1", title: "The first pass", placeId: "cortina", segmentIds: ["innsbruck-cortina"], text: "The keys, the first mountain horizon, and a road that kept finding higher ground on the way to Cortina." },
        { id: "road-d2", number: 2, date: "Day 2", title: "A loop from Cortina", placeId: "cortina", segmentIds: ["cortina-loop"], text: "We left most of the bags at the same base and made a loop over the passes. A day trip can start and finish at one marker without breaking the day model." },
        { id: "road-d3", number: 3, date: "Day 3", title: "Pass to pass and up to Seceda", placeId: "ortisei", segmentIds: ["cortina-ortisei", "ortisei-seceda-loop"], text: "Small roads and frequent stops stretched a short distance into most of the day, followed by a gondola ride above Ortisei.", highlights: [{ icon: "🚡", label: "Gondola to Seceda", lat: 46.6002, lng: 11.7246 }] },
        { id: "road-d4", number: 4, date: "Day 4", title: "Down to the valley", placeId: "bolzano", segmentIds: ["ortisei-bolzano"], text: "The road dropped out of the mountains and the journey finished in the warmer valley." }
      ],
      photos: [
        { id: "road-overlook-demo", dayId: "road-d2", src: "./assets/photos/alpine-route.webp", alt: "A winding alpine route above a lake", caption: "The road folded back toward our base", takenAt: "Day 2 · 16:40", lat: 46.55, lng: 12.04, tags: ["road", "mountains", "day trip"] }
      ]
    },
    {
      id: "danube-ride",
      label: "Danube weekend · Bike demo",
      title: "A Weekend Along the Danube",
      subtitle: "A linear ride told one day at a time",
      kicker: "BIKE JOURNEY · PASSAU TO VIENNA",
      dates: "A three-day sample",
      note: "Bike days use the same journal and photo system while emphasizing daily distance and saddle time.",
      cover: "./assets/photos/bike-pass.webp",
      places: [
        { id: "passau", name: "Passau", country: "Germany", lat: 48.5667, lng: 13.4319 },
        { id: "linz", name: "Linz", country: "Austria", lat: 48.3069, lng: 14.2858 },
        { id: "melk", name: "Melk", country: "Austria", lat: 48.227, lng: 15.3319 },
        { id: "vienna-bike", name: "Vienna", country: "Austria", lat: 48.2082, lng: 16.3738 }
      ],
      segments: [
        { id: "passau-linz", from: "passau", to: "linz", mode: "bike", distanceKm: 98, duration: "5–7 hrs", via: [[48.44, 13.76], [48.33, 13.99]] },
        { id: "linz-melk", from: "linz", to: "melk", mode: "bike", distanceKm: 116, duration: "6–8 hrs", via: [[48.23, 14.58], [48.23, 14.85]] },
        { id: "melk-vienna-bike", from: "melk", to: "vienna-bike", mode: "bike", distanceKm: 88, duration: "5–6 hrs", via: [[48.36, 15.42], [48.41, 15.61]] }
      ],
      days: [
        { id: "bike-d1", number: 1, date: "Friday", title: "Bags packed in Passau", placeId: "passau", segmentIds: [], text: "An evening beside three rivers, with the bicycle packed and the first day waiting downstream." },
        { id: "bike-d2", number: 2, date: "Saturday", title: "The long first ride", placeId: "linz", segmentIds: ["passau-linz"], text: "The river kept the route honest. We rode east all day and arrived in Linz ready to leave the bicycles untouched until morning." },
        { id: "bike-d3", number: 3, date: "Sunday", title: "Two stages to Vienna", placeId: "vienna-bike", segmentIds: ["linz-melk", "melk-vienna-bike"], text: "One day can contain more than one mapped segment. Melk became the midday hinge before the final roll into Vienna." }
      ],
      photos: [
        { id: "bike-break-demo", dayId: "bike-d3", src: "./assets/photos/bike-pass.webp", alt: "A loaded touring bicycle on a scenic route", caption: "Bags down for ten quiet minutes", takenAt: "Sunday · 13:10", lat: 48.25, lng: 15.28, tags: ["bike", "break"] }
      ]
    }
  ]
};
