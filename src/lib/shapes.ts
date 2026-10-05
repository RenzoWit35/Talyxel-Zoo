import { isLineKind, type HabitatKind } from '../../shared/constants';
import { formatArea, formatDuration, formatLength, polygonArea, polygonPerimeter, polylineLength, walkMinutes, type Point } from '../../shared/geometry';

/** Paths go underneath, areas of interest over other areas, walk routes on top of everything. */
const LAYER: Partial<Record<HabitatKind, number>> = { path: 0, interest: 2, route: 3 };
const layer = (kind: HabitatKind) => LAYER[kind] ?? 1;

/** Draw order for shapes; among areas, larger ones go first so ponds and buildings inside habitats stay visible. */
export function drawOrder(a: { kind: HabitatKind; points: Point[] }, b: { kind: HabitatKind; points: Point[] }) {
  return layer(a.kind) - layer(b.kind) || (isLineKind(a.kind) ? 0 : polygonArea(b.points) - polygonArea(a.points));
}

export const pointsAttr = (pts: readonly Point[]) => pts.map(([x, y]) => `${x},${y}`).join(' ');

/** The two headline measurements of a shape: area and perimeter, or length and walking time for a route. */
export function shapeFacts(h: { kind: HabitatKind; points: Point[] }): [{ label: string; value: string }, { label: string; value: string }] {
  if (isLineKind(h.kind)) {
    const length = polylineLength(h.points);
    return [
      { label: 'Length', value: formatLength(length) },
      { label: 'Walk time', value: formatDuration(walkMinutes(length)) },
    ];
  }
  return [
    { label: 'Area', value: formatArea(polygonArea(h.points)) },
    { label: h.kind === 'habitat' ? 'Barrier' : 'Perimeter', value: formatLength(polygonPerimeter(h.points)) },
  ];
}

/** One-line size of a shape for lists: its area, or its length for a route. */
export const shapeSize = (h: { kind: HabitatKind; points: Point[] }) =>
  isLineKind(h.kind) ? formatLength(polylineLength(h.points)) : formatArea(polygonArea(h.points));
