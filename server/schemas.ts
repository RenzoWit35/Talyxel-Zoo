import { z } from 'zod';
import { BIOMES, HABITAT_KINDS, HABITAT_STATUSES, LIMITS, PARK_TYPES, THEMES } from '../shared/constants';
import { STAT_LIMITS } from '../shared/stats';

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`);
const required = (label: string, max: number) => text(max).min(1, `${label} is required`);

export const username = z
  .string()
  .trim()
  .min(3, 'Usernames need at least 3 characters')
  .max(24, 'Usernames can be at most 24 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Use only letters, numbers and _');

export const password = z.string().min(8, 'Passwords need at least 8 characters').max(200);

export const registerInput = z.object({
  username,
  password,
  displayName: text(40).optional(),
});

export const loginInput = z.object({
  username: z.string().trim().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
});

export const profileInput = z.object({
  displayName: required('Display name', 40).optional(),
  bio: text(300).optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const mapSize = z.number().finite().min(LIMITS.mapMin).max(LIMITS.mapMax);

const setting = z.enum([...new Set([...BIOMES, ...THEMES])]);

export const zooCreateInput = z.object({
  parkType: z.enum(PARK_TYPES).default('zoo'),
  title: required('Title', 80),
  description: text(2000).default(''),
  width: mapSize.default(300),
  height: mapSize.default(200),
});

export const zooUpdateInput = z.object({
  parkType: z.enum(PARK_TYPES).optional(),
  title: required('Title', 80).optional(),
  description: text(2000).optional(),
  width: mapSize.optional(),
  height: mapSize.optional(),
  backgroundOpacity: z.number().min(0).max(1).optional(),
});

const point = z.tuple([z.number().finite(), z.number().finite()]);
export const points = z
  .array(point)
  .min(LIMITS.pointsMin, 'A shape needs at least 2 points')
  .max(LIMITS.pointsMax, `A shape can have at most ${LIMITS.pointsMax} corners`);

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colours must look like #a1b2c3');

export const habitatCreateInput = z.object({
  name: required('Name', 60).default('New habitat'),
  kind: z.enum(HABITAT_KINDS).optional(), // defaults to the park type's main kind
  status: z.enum(HABITAT_STATUSES).default('planned'),
  biome: setting.default(''),
  species: text(80).default(''),
  description: text(2000).default(''),
  color: color.optional(),
  points,
});

export const habitatUpdateInput = z.object({
  name: required('Name', 60).optional(),
  kind: z.enum(HABITAT_KINDS).optional(),
  status: z.enum(HABITAT_STATUSES).optional(),
  biome: setting.optional(),
  species: text(80).optional(),
  description: text(2000).optional(),
  color: color.optional(),
  points: points.optional(),
});

export const boardInput = z.object({
  columns: z.partialRecord(z.enum(HABITAT_STATUSES), z.array(z.number().int().positive()).max(1000)),
});

export const photoUrlInput = z.object({
  url: z
    .string()
    .trim()
    .max(2000)
    .url('That is not a valid link')
    .refine((u) => u.startsWith('https://'), 'Image links must start with https://'),
  caption: text(200).default(''),
});

export const photoUpdateInput = z.object({ caption: text(200) });

export const surveyInput = z.object({
  question: text(200).min(3, 'Ask a question of at least 3 characters'),
  options: z
    .array(required('Option', 80))
    .min(LIMITS.surveyOptionsMin, 'Add at least two options')
    .max(LIMITS.surveyOwnerOptionsMax, `At most ${LIMITS.surveyOwnerOptionsMax} options`)
    .refine((o) => new Set(o.map((s) => s.toLowerCase())).size === o.length, 'Options must be different from each other'),
  allowSuggestions: z.boolean().default(true),
});

const statsText = (label: string) => required(label, STAT_LIMITS.customText);

export const statsInput = z.object({
  values: z.record(z.string().max(40), z.number().finite().nullable()).default({}),
  custom: z
    .array(z.object({ label: statsText('Stat name'), value: statsText('Stat value') }))
    .max(STAT_LIMITS.customRows, `At most ${STAT_LIMITS.customRows} extra stats`)
    .default([]),
  gameDate: text(STAT_LIMITS.gameDate).default(''),
});

export const publishInput = z.object({
  survey: surveyInput.optional(),
});

export const voteInput = z.object({ optionId: z.number().int().positive() });
export const suggestionInput = z.object({ label: required('Suggestion', 80) });
export const surveyUpdateInput = z.object({ isOpen: z.boolean() });
