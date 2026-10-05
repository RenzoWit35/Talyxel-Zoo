export type Point = [number, number];

/** Polygon area via the shoelace formula, in square map units. */
export function polygonArea(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export function polygonPerimeter(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += Math.hypot(x2 - x1, y2 - y1);
  }
  return sum;
}

export function pointInPolygon([x, y]: Point, points: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function bounds(points: readonly Point[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * A good spot to put a label: the area-weighted centroid when it lies inside the
 * polygon, otherwise the midpoint of the widest horizontal span through the middle.
 */
export function labelPoint(points: readonly Point[]): Point {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(a) > 1e-9) {
    const c: Point = [cx / (3 * a), cy / (3 * a)];
    if (pointInPolygon(c, points)) return c;
  }
  const b = bounds(points);
  const y = (b.minY + b.maxY) / 2;
  const xs: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    if (y1 > y !== y2 > y) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
  }
  xs.sort((p, q) => p - q);
  let best: Point = [(b.minX + b.maxX) / 2, y];
  let bestWidth = -1;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const w = xs[i + 1] - xs[i];
    if (w > bestWidth) {
      bestWidth = w;
      best = [(xs[i] + xs[i + 1]) / 2, y];
    }
  }
  return best;
}

export function translate(points: readonly Point[], dx: number, dy: number): Point[] {
  return points.map(([x, y]) => [x + dx, y + dy]);
}

export function clampPoint([x, y]: Point, width: number, height: number): Point {
  return [Math.min(width, Math.max(0, x)), Math.min(height, Math.max(0, y))];
}

/** Translate a shape by (dx, dy) without letting any vertex leave the map. */
export function clampedTranslate(points: readonly Point[], dx: number, dy: number, width: number, height: number): Point[] {
  const b = bounds(points);
  const cdx = Math.min(width - b.maxX, Math.max(-b.minX, dx));
  const cdy = Math.min(height - b.maxY, Math.max(-b.minY, dy));
  return translate(points, cdx, cdy);
}

export function roundPoint([x, y]: Point, precision = 10): Point {
  return [Math.round(x * precision) / precision, Math.round(y * precision) / precision];
}

export function formatArea(m2: number): string {
  if (m2 >= 10_000) return `${(m2 / 10_000).toLocaleString('en', { maximumFractionDigits: 2 })} ha`;
  return `${Math.round(m2).toLocaleString('en')} m²`;
}

export function formatLength(m: number): string {
  if (m >= 1000) return `${(m / 1000).toLocaleString('en', { maximumFractionDigits: 2 })} km`;
  return `${Math.round(m).toLocaleString('en')} m`;
}
