import { BIOME_LABELS, KIND_META, type Biome, type HabitatKind, type ParkType } from '../shared/constants';
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
