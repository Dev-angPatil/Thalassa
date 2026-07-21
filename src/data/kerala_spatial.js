/**
 * Matsya Drishti Geospatial & Historical Reference Datasets for the Kerala Coast
 * Bounding Box: 8.0°N - 12.8°N Latitude, 74.5°E - 77.5°E Longitude
 */

// Coastline coordinates (simplified representation from South to North)
export const KERALA_COASTLINE = [
  { lat: 8.08, lng: 77.55 }, // Kanyakumari border
  { lat: 8.30, lng: 77.08 }, // Poovar / Vizhinjam
  { lat: 8.48, lng: 76.95 }, // Thiruvananthapuram
  { lat: 8.88, lng: 76.54 }, // Neendakara / Kollam
  { lat: 9.35, lng: 76.36 }, // Kayamkulam
  { lat: 9.49, lng: 76.32 }, // Alappuzha
  { lat: 9.97, lng: 76.22 }, // Kochi / Ernakulam
  { lat: 10.22, lng: 76.16 }, // Munambam
  { lat: 10.60, lng: 75.96 }, // Ponnani
  { lat: 11.15, lng: 75.83 }, // Beypore / Kozhikode
  { lat: 11.45, lng: 75.60 }, // Quilandy
  { lat: 11.72, lng: 75.53 }, // Chombal / Mahe
  { lat: 11.87, lng: 75.35 }, // Kannur / Mopla Bay
  { lat: 12.02, lng: 75.24 }, // Azheekkal
  { lat: 12.42, lng: 75.02 }, // Kasaragod
  { lat: 12.78, lng: 74.88 }  // Manjeshwar / Karnataka border
];

// Major fishing harbors and ports along the Kerala coast
export const FISHING_HARBORS = [
  {
    id: "vizhinjam",
    name: "Vizhinjam Fishing Harbour",
    district: "Thiruvananthapuram",
    lat: 8.375,
    lng: 76.987,
    capacityTons: 12000,
    activeVessels: 450,
    depthMeters: 10
  },
  {
    id: "neendakara",
    name: "Neendakara Fishing Harbour",
    district: "Kollam",
    lat: 8.938,
    lng: 76.538,
    capacityTons: 25000,
    activeVessels: 850,
    depthMeters: 8
  },
  {
    id: "munambam",
    name: "Munambam Fishing Harbour",
    district: "Ernakulam",
    lat: 10.182,
    lng: 76.177,
    capacityTons: 20000,
    activeVessels: 720,
    depthMeters: 7
  },
  {
    id: "beypore",
    name: "Beypore Fishing Harbour",
    district: "Kozhikode",
    lat: 11.161,
    lng: 75.811,
    capacityTons: 15000,
    activeVessels: 580,
    depthMeters: 6
  },
  {
    id: "azheekkal",
    name: "Azheekkal Fishing Harbour",
    district: "Kannur",
    lat: 12.021,
    lng: 75.242,
    capacityTons: 8000,
    activeVessels: 320,
    depthMeters: 5
  }
];

// Marine Protected Areas (MPAs) & Ecologically Sensitive Zones (ESZs)
export const CONSERVATION_ZONES = [
  {
    id: "wadge_bank",
    name: "Wadge Bank Marine Ecosystem",
    description: "Critical spawning ground for demersal finfishes, subject to strict seasonal restrictions.",
    type: "ESZ",
    severityLevel: "high", // high / medium / low
    polygon: [
      { lat: 8.00, lng: 76.50 },
      { lat: 8.40, lng: 76.50 },
      { lat: 8.40, lng: 77.20 },
      { lat: 8.00, lng: 77.20 }
    ],
    restrictedMonths: [6, 7, 8] // June, July, August (Monsoon Trawling Ban)
  },
  {
    id: "ashtamudi_estuary",
    name: "Ashtamudi Estuary Marine Sanctuary",
    description: "Ramsar wetland site, nursery ground for short-neck clams and penaeid prawns.",
    type: "Sanctuary",
    severityLevel: "high",
    polygon: [
      { lat: 8.90, lng: 76.45 },
      { lat: 9.05, lng: 76.45 },
      { lat: 9.05, lng: 76.58 },
      { lat: 8.90, lng: 76.58 }
    ],
    restrictedMonths: [11, 12, 1] // November to January (Spawning peak)
  },
  {
    id: "vembanad_conservation",
    name: "Vembanad Estuarine Coral & Seagrass Sanctuary",
    description: "Seagrass beds and mudflats hosting endangered seahorses and juvenile shrimp stocks.",
    type: "Conservation Reserve",
    severityLevel: "medium",
    polygon: [
      { lat: 9.80, lng: 76.15 },
      { lat: 10.15, lng: 76.15 },
      { lat: 10.15, lng: 76.28 },
      { lat: 9.80, lng: 76.28 }
    ],
    restrictedMonths: [4, 5, 6] // Spawning and recruitment peak
  },
  {
    id: "kadalu_nesting",
    name: "Kadalundi Estuary Olive Ridley Nesting Zone",
    description: "Nesting beaches and adjacent nearshore waters for Olive Ridley turtles.",
    type: "Sanctuary",
    severityLevel: "high",
    polygon: [
      { lat: 11.10, lng: 75.75 },
      { lat: 11.25, lng: 75.75 },
      { lat: 11.25, lng: 75.88 },
      { lat: 11.10, lng: 75.88 }
    ],
    restrictedMonths: [12, 1, 2, 3] // Nesting and hatching season (December to March)
  }
];

// District-wise historical landings and catch statistics (Kerala State Fisheries Dept)
// Averaged yearly catch distributions in metric tons (MT)
export const DISTRICT_CATCH_DATA = [
  {
    district: "Thiruvananthapuram",
    mainSpecies: ["Indian Oil Sardine", "Mackerel", "Anchovy", "Tuna"],
    annualCatchMT: 62450,
    historicalOverfishingIndex: 0.65 // Scale 0-1
  },
  {
    district: "Kollam",
    mainSpecies: ["Threadfin Bream", "Squid", "Ribbon Fish", "Penaeid Prawns"],
    annualCatchMT: 108300,
    historicalOverfishingIndex: 0.82
  },
  {
    district: "Alappuzha",
    mainSpecies: ["Indian Oil Sardine", "Mackerel", "Shrimp", "Anchovy"],
    annualCatchMT: 74200,
    historicalOverfishingIndex: 0.58
  },
  {
    district: "Ernakulam",
    mainSpecies: ["Ribbon Fish", "Cuttlefish", "Prawns", "Croakers"],
    annualCatchMT: 89600,
    historicalOverfishingIndex: 0.76
  },
  {
    district: "Kozhikode",
    mainSpecies: ["Mackerel", "Oil Sardine", "Threadfin Bream", "Sole fish"],
    annualCatchMT: 54100,
    historicalOverfishingIndex: 0.61
  },
  {
    district: "Kannur",
    mainSpecies: ["Indian Oil Sardine", "Mackerel", "Anchovy", "Shrimp"],
    annualCatchMT: 38200,
    historicalOverfishingIndex: 0.49
  }
];

// Typical Spawning Calendars for commercial species in Kerala
export const SPECIES_SPAWNING_CALENDAR = [
  {
    name: "Indian Oil Sardine (Sardinella longiceps)",
    spawningPeak: "June - August",
    months: [6, 7, 8],
    minSST: 26.5,
    maxSST: 28.5
  },
  {
    name: "Indian Mackerel (Rastrelliger kanagurta)",
    spawningPeak: "May - July & October - November",
    months: [5, 6, 7, 10, 11],
    minSST: 27.0,
    maxSST: 29.0
  },
  {
    name: "Threadfin Breams (Nemipterus spp.)",
    spawningPeak: "September - November",
    months: [9, 10, 11],
    minSST: 25.5,
    maxSST: 27.5
  },
  {
    name: "Karikkadi Prawn (Parapenaeopsis stylifera)",
    spawningPeak: "December - February & May",
    months: [12, 1, 2, 5],
    minSST: 28.0,
    maxSST: 30.0
  }
];
