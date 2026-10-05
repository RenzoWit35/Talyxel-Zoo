import type { ParkType } from './constants';

/**
 * In-game statistics a builder copies over from Planet Zoo or Planet Coaster by hand.
 * Each park type has its own fields; anything else goes in free-form custom rows.
 */
export type StatType = 'int' | 'decimal' | 'percent' | 'rating' | 'money';

export interface StatField {
  key: string;
  label: string;
  type: StatType;
  group: 'Visitors' | 'Animals' | 'Rides' | 'Money' | 'Running the park';
  hint?: string;
}

const VISITORS = (ratingLabel: string, ratingType: StatType, ratingHint: string): StatField[] => [
  { key: 'guests', label: 'Guests', type: 'int', group: 'Visitors', hint: 'Guests in the park right now' },
  { key: 'guestHappiness', label: 'Guest happiness', type: 'percent', group: 'Visitors' },
  { key: 'rating', label: ratingLabel, type: ratingType, group: 'Visitors', hint: ratingHint },
];

const MONEY: StatField[] = [
  { key: 'cash', label: 'Bank balance', type: 'money', group: 'Money' },
  { key: 'monthlyProfit', label: 'Monthly profit', type: 'money', group: 'Money', hint: 'Negative for a loss' },
  { key: 'entryPrice', label: 'Entry price', type: 'money', group: 'Money' },
];

export const STAT_FIELDS: Record<ParkType, StatField[]> = {
  zoo: [
    ...VISITORS('Zoo rating', 'rating', '0 to 5 stars'),
    { key: 'animals', label: 'Animals', type: 'int', group: 'Animals' },
    { key: 'species', label: 'Species', type: 'int', group: 'Animals' },
    { key: 'animalWelfare', label: 'Animal welfare', type: 'percent', group: 'Animals' },
    { key: 'conservationCredits', label: 'Conservation credits', type: 'int', group: 'Animals' },
    { key: 'releasedToWild', label: 'Released to the wild', type: 'int', group: 'Animals' },
    ...MONEY,
    { key: 'staff', label: 'Staff', type: 'int', group: 'Running the park' },
    { key: 'education', label: 'Education', type: 'percent', group: 'Running the park', hint: 'Guest education score' },
  ],
  theme_park: [
    ...VISITORS('Park rating', 'percent', 'Overall park rating'),
    { key: 'rides', label: 'Rides', type: 'int', group: 'Rides' },
    { key: 'coasters', label: 'Coasters', type: 'int', group: 'Rides' },
    { key: 'avgExcitement', label: 'Average excitement', type: 'decimal', group: 'Rides', hint: 'Excitement rating, e.g. 6.4' },
    { key: 'scenery', label: 'Scenery', type: 'percent', group: 'Rides', hint: 'Scenery rating' },
    ...MONEY,
    { key: 'staff', label: 'Staff', type: 'int', group: 'Running the park' },
  ],
};

export const statFields = (type: ParkType) => STAT_FIELDS[type] ?? STAT_FIELDS.zoo;

/** The few stats shown on cards and summaries, in order of preference. */
export const HEADLINE_STATS = ['guests', 'rating', 'guestHappiness', 'monthlyProfit'];

export const STAT_LIMITS = { customRows: 12, customText: 40, gameDate: 40 } as const;

/** Allowed range per type. Money may go negative (loans, losses). */
export const STAT_RANGE: Record<StatType, { min: number; max: number; integer?: boolean }> = {
  int: { min: 0, max: 1_000_000_000, integer: true },
  decimal: { min: 0, max: 1_000_000 },
  percent: { min: 0, max: 100 },
  rating: { min: 0, max: 5 },
  money: { min: -1_000_000_000_000, max: 1_000_000_000_000 },
};

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

function money(n: number) {
  const abs = Math.abs(n);
  const text = abs >= 100_000 ? compact.format(abs) : whole.format(abs);
  return `${n < 0 ? '−' : ''}$${text}`;
}

export function formatStat(type: StatType, value: number): string {
  switch (type) {
    case 'int':
      return value >= 1_000_000 ? compact.format(value) : whole.format(value);
    case 'decimal':
      return oneDecimal.format(value);
    case 'percent':
      return `${oneDecimal.format(value)}%`;
    case 'rating':
      return `${oneDecimal.format(value)} ★`;
    case 'money':
      return money(value);
  }
}

/** "+1,200", "−3.5%", "+$40k" — the change since the previous snapshot, or null when nothing changed. */
export function formatStatChange(type: StatType, change: number): string | null {
  if (Math.abs(change) < 1e-9) return null;
  const sign = change > 0 ? '+' : '−';
  const abs = Math.abs(change);
  if (type === 'money') return `${sign}${money(abs)}`;
  if (type === 'percent') return `${sign}${oneDecimal.format(abs)} pt`;
  return `${sign}${type === 'int' ? (abs >= 1_000_000 ? compact.format(abs) : whole.format(abs)) : oneDecimal.format(abs)}`;
}
