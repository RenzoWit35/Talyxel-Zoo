export const PARK_TYPES = ['zoo', 'theme_park'] as const;
export type ParkType = (typeof PARK_TYPES)[number];

/** Every shape type across all park types; each park type allows a subset (see shared/parks.ts). */
export const HABITAT_KINDS = [
  'habitat',
  'exhibit',
  'coaster',
  'ride',
  'water_ride',
  'shop',
  'zone',
  'facility',
  'water',
  'path',
  'scenery',
] as const;
export type HabitatKind = (typeof HABITAT_KINDS)[number];

export const HABITAT_STATUSES = ['idea', 'planned', 'building', 'done'] as const;
export type HabitatStatus = (typeof HABITAT_STATUSES)[number];

/** Zoo biomes. */
export const BIOMES = ['', 'tropical', 'temperate', 'grassland', 'desert', 'taiga', 'tundra', 'aquatic'] as const;
/** Theme park themes. */
export const THEMES = ['', 'pirate', 'fairytale', 'western', 'scifi', 'spooky', 'adventure', 'studios', 'viking', 'classic'] as const;
/** A shape's setting: a biome in zoos, a theme in theme parks. Stored in the habitat's `biome` field. */
export type Biome = (typeof BIOMES)[number] | (typeof THEMES)[number];

export const KIND_META: Record<HabitatKind, { label: string; noun: string; color: string; hint: string }> = {
  habitat: { label: 'Habitat', noun: 'Habitat', color: '#5f9e5c', hint: 'Large animal enclosure' },
  exhibit: { label: 'Exhibit', noun: 'Exhibit', color: '#c79a3c', hint: 'Reptile house, aviary, small animals' },
  coaster: { label: 'Roller coaster', noun: 'Coaster', color: '#c2543f', hint: 'Track layout, station and queue' },
  ride: { label: 'Flat ride', noun: 'Ride', color: '#d9813a', hint: 'Carousels, drop towers, Ferris wheels' },
  water_ride: { label: 'Water ride', noun: 'Water ride', color: '#3f9fb8', hint: 'Log flumes, rapids, splash boats' },
  shop: { label: 'Shop / food', noun: 'Shop', color: '#c79a3c', hint: 'Food, drinks and souvenir stalls' },
  zone: { label: 'Themed area', noun: 'Area', color: '#a9c49a', hint: 'A land like “Pirate Cove” that rides sit inside' },
  facility: { label: 'Facility', noun: 'Facility', color: '#8a78c4', hint: 'Restrooms, first aid, staff buildings' },
  water: { label: 'Water', noun: 'Water', color: '#4c98cc', hint: 'Lakes, rivers, pools' },
  path: { label: 'Path / plaza', noun: 'Path', color: '#bfa98a', hint: 'Guest paths, queues and plazas' },
  scenery: { label: 'Scenery', noun: 'Scenery', color: '#93b85c', hint: 'Gardens, forests, decoration' },
};

export const STATUS_META: Record<HabitatStatus, { label: string; color: string }> = {
  idea: { label: 'Idea', color: '#8e7fb0' },
  planned: { label: 'Planned', color: '#4a83c4' },
  building: { label: 'Building', color: '#d38a2e' },
  done: { label: 'Done', color: '#3f8b52' },
};

export const BIOME_LABELS: Record<Biome, string> = {
  '': 'None',
  tropical: 'Tropical',
  temperate: 'Temperate',
  grassland: 'Grassland',
  desert: 'Desert',
  taiga: 'Taiga',
  tundra: 'Tundra',
  aquatic: 'Aquatic',
  pirate: 'Pirate',
  fairytale: 'Fairytale',
  western: 'Western',
  scifi: 'Sci-Fi',
  spooky: 'Spooky',
  adventure: 'Adventure',
  studios: 'Studios',
  viking: 'Viking',
  classic: 'Classic',
};

/** Swatches offered in the habitat colour picker. */
export const HABITAT_COLORS = [
  '#5f9e5c',
  '#93b85c',
  '#3e7a5a',
  '#c79a3c',
  '#d9733f',
  '#b65a4a',
  '#8a78c4',
  '#4c98cc',
  '#4fb3a9',
  '#bfa98a',
  '#9c8a6e',
  '#d47fa6',
  '#c2543f',
  '#3f9fb8',
];

export const AVATAR_COLORS = ['#2f6b47', '#3e7a8c', '#7a5aa6', '#b5643c', '#a8455a', '#5d6b2f', '#2f5c8a', '#8a6a2f'];

export const LIMITS = {
  mapMin: 20,
  mapMax: 2000,
  pointsMin: 3,
  pointsMax: 300,
  photosPerHabitat: 40,
  uploadBytes: 8 * 1024 * 1024,
  surveyOptionsMin: 2,
  surveyOptionsMax: 20,
  surveyOwnerOptionsMax: 10,
} as const;
