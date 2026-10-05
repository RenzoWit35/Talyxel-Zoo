import type { HabitatKind } from '../../shared/constants';
import { polygonArea, type Point } from '../../shared/geometry';

/** Paths go underneath everything; otherwise larger shapes are drawn first so ponds and buildings inside habitats stay visible. */
export function drawOrder(a: { kind: HabitatKind; points: Point[] }, b: { kind: HabitatKind; points: Point[] }) {
  const pa = a.kind === 'path' ? 0 : 1;
  const pb = b.kind === 'path' ? 0 : 1;
  return pa - pb || polygonArea(b.points) - polygonArea(a.points);
}
