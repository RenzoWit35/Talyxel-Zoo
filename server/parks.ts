import { BIOME_LABELS, isLineKind, KIND_META, minPoints, type Biome, type HabitatKind, type ParkType } from '../shared/constants';
import type { Point } from '../shared/geometry';
import { parkMeta } from '../shared/parks';
import { badRequest } from './http';

/** Reject shape types and biomes/themes that don't belong to the park's type. */
export function checkShapeFits(parkType: ParkType, kind?: HabitatKind, biome?: Biome) {
  const meta = parkMeta(parkType);
  if (kind && !meta.kinds.includes(kind)) {
    throw badRequest(`${KIND_META[kind].label} shapes aren't available in a ${meta.noun}`);
  }
  if (biome && !meta.settings.includes(biome)) {
    throw badRequest(`“${BIOME_LABELS[biome]}” isn't a ${meta.settingLabel.toLowerCase()} you can use in a ${meta.noun}`);
  }
}

/**
 * Lines (walk routes) need 2 points and areas 3 corners. A line can't become an
 * area or the other way round — the outline wouldn't mean the same thing.
 */
export function checkGeometry(kind: HabitatKind, points: readonly Point[], previousKind?: HabitatKind) {
  if (previousKind && isLineKind(previousKind) !== isLineKind(kind)) {
    throw badRequest(
      isLineKind(previousKind)
        ? `A ${KIND_META[previousKind].label.toLowerCase()} is a line — draw a new shape to make an area`
        : `An area can't become a ${KIND_META[kind].label.toLowerCase()} — draw the line instead`,
    );
  }
  if (points.length < minPoints(kind)) {
    throw badRequest(isLineKind(kind) ? `A ${KIND_META[kind].label.toLowerCase()} needs at least 2 points` : 'An area needs at least 3 corners');
  }
}
