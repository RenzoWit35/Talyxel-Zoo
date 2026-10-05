import { Droplets, PawPrint, Route, Store, Trees, Turtle, type LucideProps } from 'lucide-react';
import type { HabitatKind } from '../../shared/constants';

const ICONS = { habitat: PawPrint, exhibit: Turtle, facility: Store, water: Droplets, path: Route, scenery: Trees };

export function KindIcon({ kind, ...props }: { kind: HabitatKind } & LucideProps) {
  const Icon = ICONS[kind];
  return <Icon {...props} />;
}
