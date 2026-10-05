import { Castle, Droplets, FerrisWheel, PawPrint, Popcorn, RollerCoaster, Route, Store, Trees, Turtle, Waves, type LucideProps } from 'lucide-react';
import type { HabitatKind } from '../../shared/constants';

const ICONS = {
  habitat: PawPrint,
  exhibit: Turtle,
  coaster: RollerCoaster,
  ride: FerrisWheel,
  water_ride: Waves,
  shop: Popcorn,
  zone: Castle,
  facility: Store,
  water: Droplets,
  path: Route,
  scenery: Trees,
} satisfies Record<HabitatKind, unknown>;

export function KindIcon({ kind, ...props }: { kind: HabitatKind } & LucideProps) {
  const Icon = ICONS[kind] ?? PawPrint;
  return <Icon {...props} />;
}
