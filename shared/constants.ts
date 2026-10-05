export const HABITAT_KINDS = ['habitat', 'exhibit', 'facility', 'water', 'path', 'scenery'] as const;
export type HabitatKind = (typeof HABITAT_KINDS)[number];

export const HABITAT_STATUSES = ['idea', 'planned', 'building', 'done'] as const;
export type HabitatStatus = (typeof HABITAT_STATUSES)[number];

export const BIOMES = ['', 'tropical', 'temperate', 'grassland', 'desert', 'taiga', 'tundra', 'aquatic'] as const;
export type Biome = (typeof BIOMES)[number];

export const KIND_META: Record<HabitatKind, { label: string; color: string; hint: string }> = {
  habitat: { label: 'Habitat', color: '#5f9e5c', hint: 'Large animal enclosure' },
  exhibit: { label: 'Exhibit', color: '#c79a3c', hint: 'Reptile house, aviary, small animals' },
  facility: { label: 'Facility', color: '#8a78c4', hint: 'Shops, restrooms, staff buildings' },
  water: { label: 'Water', color: '#4c98cc', hint: 'Lakes, rivers, pools' },
  path: { label: 'Path / plaza', color: '#bfa98a', hint: 'Guest paths and plazas' },
  scenery: { label: 'Scenery', color: '#93b85c', hint: 'Gardens, forests, decoration' },
};

export const STATUS_META: Record<HabitatStatus, { label: string; color: string }> = {
  idea: { label: 'Idea', color: '#8e7fb0' },
  planned: { label: 'Planned', color: '#4a83c4' },
  building: { label: 'Building', color: '#d38a2e' },
  done: { label: 'Done', color: '#3f8b52' },
};

export const BIOME_LABELS: Record<Biome, string> = {
  '': 'No biome',
  tropical: 'Tropical',
  temperate: 'Temperate',
  grassland: 'Grassland',
  desert: 'Desert',
  taiga: 'Taiga',
  tundra: 'Tundra',
  aquatic: 'Aquatic',
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
