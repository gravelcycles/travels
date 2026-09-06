/*
  Journey Atlas content lives here.

  Each journey is organized by days, not nights or transport legs. A day can:
  - stay in one place (segmentIds: [])
  - travel from one place to another
  - loop back to a base
  - combine several segments and transport modes

  Photos belong to a day through dayId. They may also have exact GPS coordinates,
  EXIF time, tags, and OCR text. Photo src values can be local paths or HTTPS URLs.
*/
window.JOURNEY_ATLAS_DATA = {
  defaultJourneyId: "alpine-crossing",
  journeys: [
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
        { id: "como", name: "Como", country: "Italy", lat: 45.8081, lng: 9.0852 },
        { id: "freiburg", name: "Freiburg", country: "Germany", lat: 47.999, lng: 7.8421 }
      ],
      segments: [
        { id: "lucerne-andermatt", from: "lucerne", to: "andermatt", mode: "train", distanceKm: 75, duration: "1 hr 50", via: [[46.835, 8.638]] },
        { id: "andermatt-disentis", from: "andermatt", to: "disentis", mode: "bike", distanceKm: 62, duration: "4–6 hrs", via: [[46.658, 8.671], [46.563, 8.8]] },
        { id: "disentis-st-moritz", from: "disentis", to: "st-moritz", mode: "train", distanceKm: 98, duration: "2 hr 25", via: [[46.775, 9.207], [46.697, 9.441]] },
        { id: "st-moritz-como", from: "st-moritz", to: "como", mode: "bus", distanceKm: 125, duration: "3–4 hrs", via: [[46.17, 9.89], [45.98, 9.56]] },
        { id: "como-freiburg", from: "como", to: "freiburg", mode: "car", distanceKm: 344, duration: "4 hr 35", via: [[46.51, 8.94], [47.37, 8.54]] }
      ],
      days: [
        { id: "alps-d1", number: 1, date: "18 Aug", title: "Arrival beside the lake", placeId: "lucerne", segmentIds: [], text: "We reached Lucerne late enough for the old city to feel quiet. The first evening was mostly a walk along the water and the relief of putting the bags down." },
        { id: "alps-d2", number: 2, date: "19 Aug", title: "A slow Lucerne day", placeId: "lucerne", segmentIds: [], text: "No travel today. We crossed the river several times, stopped whenever the light changed, and left the timetable folded in a pocket." },
        { id: "alps-d3", number: 3, date: "20 Aug", title: "Up the Reuss valley", placeId: "andermatt", segmentIds: ["lucerne-andermatt"], text: "The train climbed into a tighter valley with every stop. By Andermatt, the route ahead finally looked as steep as it had on the map." },
        { id: "alps-d4", number: 4, date: "21 Aug", title: "Over the pass", placeId: "disentis", segmentIds: ["andermatt-disentis"], text: "The slowest day of the trip earned the widest views. We climbed in cool air, stopped for coffee near the top, and rolled down toward Disentis with the valley opening below us." },
        { id: "alps-d5", number: 5, date: "22 Aug", title: "A full window-seat day", placeId: "st-moritz", segmentIds: ["disentis-st-moritz"], text: "A day measured in tunnels, sudden lakes and the few seconds when a village appeared perfectly framed in the window. This is the sample day with more than one photograph." },
        { id: "alps-d6", number: 6, date: "23 Aug", title: "High-valley pause", placeId: "st-moritz", segmentIds: [], text: "We stayed in the high valley and let the route rest. The day was for short walks, weather moving over the ridges, and nowhere we had to be." },
        { id: "alps-d7", number: 7, date: "24 Aug", title: "Across the border", placeId: "como", segmentIds: ["st-moritz-como"], text: "The bus threaded south through the mountains. The air softened after the border, and by evening the lake felt like an entirely different trip." },
        { id: "alps-d8", number: 8, date: "25 Aug", title: "Ferries and rain clouds", placeId: "como", segmentIds: [], text: "A same-place day can still hold a full story. We followed the shoreline, waited out a shower under an arcade, and watched the ferries redraw the lake." },
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
        { id: "ortisei-bolzano", from: "ortisei", to: "bolzano", mode: "car", distanceKm: 40, duration: "1 hr" }
      ],
      days: [
        { id: "road-d1", number: 1, date: "Day 1", title: "The first pass", placeId: "cortina", segmentIds: ["innsbruck-cortina"], text: "The keys, the first mountain horizon, and a road that kept finding higher ground on the way to Cortina." },
        { id: "road-d2", number: 2, date: "Day 2", title: "A loop from Cortina", placeId: "cortina", segmentIds: ["cortina-loop"], text: "We left most of the bags at the same base and made a loop over the passes. A day trip can start and finish at one marker without breaking the day model." },
        { id: "road-d3", number: 3, date: "Day 3", title: "Pass to pass", placeId: "ortisei", segmentIds: ["cortina-ortisei"], text: "Small roads and frequent stops stretched a short distance into most of the day." },
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
