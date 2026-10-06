import { BIOMES, THEMES, type Biome, type HabitatKind, type ParkType } from './constants';
import { RIDE_TYPES } from './rides';
import { SPECIES } from './species';

export interface ParkMeta {
  label: string;
  /** The game this park type is planned for. */
  game: string;
  /** Lower-case noun for one plan of this type ("zoo", "theme park"). */
  noun: string;
  kinds: readonly HabitatKind[];
  defaultKind: HabitatKind;
  /** New shapes of the default kind cycle through these colours so neighbours look different. */
  colors: readonly string[];
  /** The shapes that count as the park's main attractions in stats. */
  featureKinds: readonly HabitatKind[];
  featureNoun: [singular: string, plural: string];
  featureAreaLabel: string;
  /** Short label for the main-attraction area stat in the planner. */
  featureStatLabel: string;
  /** Label of the per-shape `species` field. */
  subjectLabel: string;
  subjectNoun: [singular: string, plural: string];
  subjectPlaceholder: string;
  subjects: readonly string[];
  /** Label of the per-shape `biome` field. */
  settingLabel: string;
  /** Example design principle for the planner's park panel. */
  principlePlaceholder: string;
  settings: readonly Biome[];
  namePlaceholder: string;
  ideaExample: string;
  notesPlaceholder: string;
  optionExamples: [string, string];
}

export const PARK_META: Record<ParkType, ParkMeta> = {
  zoo: {
    label: 'Zoo',
    game: 'Planet Zoo',
    noun: 'zoo',
    kinds: ['habitat', 'exhibit', 'utility', 'route', 'interest', 'facility', 'water', 'path', 'scenery'],
    defaultKind: 'habitat',
    colors: ['#5f9e5c', '#93b85c', '#3e7a5a', '#c79a3c', '#d9733f', '#b65a4a'],
    featureKinds: ['habitat', 'exhibit'],
    featureNoun: ['enclosure', 'enclosures'],
    featureAreaLabel: 'for animals',
    featureStatLabel: 'Animals',
    subjectLabel: 'Species',
    subjectNoun: ['species', 'species'],
    subjectPlaceholder: 'e.g. Bengal Tiger',
    subjects: SPECIES,
    settingLabel: 'Biome',
    principlePlaceholder: 'e.g. Landscape first, then the animals — never the other way round.',
    settings: BIOMES,
    namePlaceholder: 'e.g. Talyxel Wildlife Park',
    ideaExample: 'Penguin pool',
    notesPlaceholder: 'Theme, terrain, enrichment, guest views, what’s still missing…',
    optionExamples: ['e.g. Red Panda habitat', 'e.g. Reptile house'],
  },
  theme_park: {
    label: 'Theme park',
    game: 'Planet Coaster',
    noun: 'theme park',
    kinds: ['coaster', 'ride', 'water_ride', 'shop', 'zone', 'utility', 'route', 'interest', 'facility', 'water', 'path', 'scenery'],
    defaultKind: 'coaster',
    colors: ['#c2543f', '#8a78c4', '#d9813a', '#3f9fb8', '#d47fa6', '#4f7fb8'],
    featureKinds: ['coaster', 'ride', 'water_ride'],
    featureNoun: ['attraction', 'attractions'],
    featureAreaLabel: 'of rides',
    featureStatLabel: 'Rides',
    subjectLabel: 'Ride type',
    subjectNoun: ['ride type', 'ride types'],
    subjectPlaceholder: 'e.g. Wooden coaster',
    subjects: RIDE_TYPES,
    settingLabel: 'Theme',
    principlePlaceholder: 'e.g. Every coaster is part of the skyline you see from Main Street.',
    settings: THEMES,
    namePlaceholder: 'e.g. Thunder Peak Adventure Park',
    ideaExample: 'Log flume',
    notesPlaceholder: 'Theming, queue line, ride stats, excitement rating, what’s still missing…',
    optionExamples: ['e.g. A launched coaster', 'e.g. Haunted house'],
  },
};

export const parkMeta = (type: ParkType): ParkMeta => PARK_META[type] ?? PARK_META.zoo;
