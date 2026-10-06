import { isLineKind, type HabitatKind } from '../../../shared/constants';
import { bounds, labelPoint, pointInPolygon, polygonArea, type Point } from '../../../shared/geometry';
import { shade } from '../../lib/color';
import { pointsAttr } from '../../lib/shapes';

/**
 * The "blueprint" look of a park map: grass on the ground, a hedge around the edge, and on every
 * shape something that says what it is — trees in habitats, ripples on water, paving on paths,
 * roofs and shadows on buildings, a track in coaster areas. Everything is drawn in map metres,
 * so it grows when you zoom in, and it's seeded by the shape so it never jumps around.
 */

interface DecorShape {
  id?: number;
  kind: HabitatKind;
  color: string;
  points: Point[];
}

/** Size of one texture "cell" in metres, relative to the park so thumbnails and big maps look alike. */
export const terrainUnit = (width: number, height: number) => Math.max(width, height) / 250;

const BUILDINGS: readonly HabitatKind[] = ['exhibit', 'shop', 'facility', 'utility'];
/** Tree canopies stay green whatever colour the area is. */
const TREE_GREENS = ['#3f7a3d', '#4c8a46', '#5d9a50', '#356b38'];
const WOODED: readonly HabitatKind[] = ['habitat', 'scenery'];
const WET: readonly HabitatKind[] = ['water', 'water_ride'];
export const castsShadow = (kind: HabitatKind) => BUILDINGS.includes(kind) || kind === 'coaster' || kind === 'ride';

function seeded(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable number for a shape that has no id yet (e.g. in a thumbnail list). */
function seedOf(s: DecorShape) {
  if (s.id) return s.id * 7919;
  let h = 17;
  for (const [x, y] of s.points) h = (h * 31 + Math.round(x * 3) * 7 + Math.round(y * 3)) >>> 0;
  return h;
}

/** Up to `count` points inside the polygon, at least `gap` apart. */
function scatter(points: Point[], count: number, rand: () => number, gap: number): Point[] {
  const b = bounds(points);
  const out: Point[] = [];
  for (let tries = 0; out.length < count && tries < count * 25; tries++) {
    const p: Point = [b.minX + rand() * b.width, b.minY + rand() * b.height];
    if (!pointInPolygon(p, points)) continue;
    if (out.some(([x, y]) => (x - p[0]) ** 2 + (y - p[1]) ** 2 < gap * gap)) continue;
    out.push(p);
  }
  return out;
}

/** The polygon pulled toward its middle (0.8 = 80% of the size). */
function inset(points: Point[], k: number): Point[] {
  const [cx, cy] = labelPoint(points);
  return points.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

/** A smooth closed curve through the points (Catmull-Rom as cubic Béziers). */
function smoothLoop(points: Point[]): string {
  const n = points.length;
  if (n < 3) return '';
  const p = (i: number) => points[(i + n) % n];
  let d = `M ${p(0)[0]} ${p(0)[1]}`;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = p(i - 1);
    const [x1, y1] = p(i);
    const [x2, y2] = p(i + 1);
    const [x3, y3] = p(i + 2);
    d += ` C ${x1 + (x2 - x0) / 6} ${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6} ${y2 - (y3 - y1) / 6} ${x2} ${y2}`;
  }
  return `${d} Z`;
}

interface Decor {
  trees: { x: number; y: number; r: number }[];
  rocks: { x: number; y: number; r: number }[];
  roof: Point[] | null;
  ridge: [Point, Point] | null;
  track: string | null;
  ride: { x: number; y: number; r: number } | null;
}

const cache = new WeakMap<Point[], Map<string, Decor>>();

function decorFor(s: DecorShape, u: number): Decor {
  const key = `${s.kind}:${u.toFixed(3)}`;
  let byKey = cache.get(s.points);
  const hit = byKey?.get(key);
  if (hit) return hit;
  const rand = seeded(seedOf(s));
  const area = polygonArea(s.points);
  const decor: Decor = { trees: [], rocks: [], roof: null, ridge: null, track: null, ride: null };

  if (WOODED.includes(s.kind)) {
    const r = u * 1.7;
    const density = s.kind === 'scenery' ? 9 : 30;
    const count = Math.min(s.kind === 'scenery' ? 60 : 28, Math.floor(area / (r * r * density)));
    decor.trees = scatter(s.points, count, rand, r * 1.3).map(([x, y]) => ({ x, y, r: r * (0.75 + rand() * 0.55) }));
    if (s.kind === 'habitat') {
      decor.rocks = scatter(s.points, Math.min(4, Math.floor(area / (u * u * 400))), rand, u * 4).map(([x, y]) => ({ x, y, r: u * (0.7 + rand() * 0.6) }));
    }
  }
  if (BUILDINGS.includes(s.kind)) {
    decor.roof = inset(s.points, 0.8);
    const b = bounds(s.points);
    const [cx, cy] = labelPoint(s.points);
    decor.ridge =
      b.width >= b.height
        ? [
            [cx - b.width * 0.3, cy],
            [cx + b.width * 0.3, cy],
          ]
        : [
            [cx, cy - b.height * 0.3],
            [cx, cy + b.height * 0.3],
          ];
  }
  if (s.kind === 'coaster' || s.kind === 'water_ride') decor.track = smoothLoop(inset(s.points, 0.74));
  if (s.kind === 'ride') {
    const b = bounds(s.points);
    const [x, y] = labelPoint(s.points);
    decor.ride = { x, y, r: Math.min(b.width, b.height) * 0.32 };
  }

  if (!byKey) cache.set(s.points, (byKey = new Map()));
  byKey.set(key, decor);
  return decor;
}

/** Patterns shared by every shape on one map. `prefix` keeps ids unique when a page shows several maps. */
export function TerrainDefs({ prefix, u }: { prefix: string; u: number }) {
  return (
    <>
      <pattern id={`${prefix}grass`} width={u * 9} height={u * 9} patternUnits="userSpaceOnUse">
        <g fill="var(--ground-tuft)">
          <circle cx={u * 1.2} cy={u * 1.6} r={u * 0.35} />
          <circle cx={u * 5.6} cy={u * 3.1} r={u * 0.25} />
          <circle cx={u * 3.1} cy={u * 6.4} r={u * 0.3} />
          <circle cx={u * 7.8} cy={u * 7.6} r={u * 0.4} />
          <circle cx={u * 8.4} cy={u * 0.9} r={u * 0.2} />
        </g>
      </pattern>
      <pattern id={`${prefix}ripple`} width={u * 6} height={u * 3.2} patternUnits="userSpaceOnUse">
        <path d={`M ${u * 0.4} ${u * 1.6} q ${u * 0.9} ${-u * 0.8} ${u * 1.8} 0`} fill="none" stroke="#ffffff" strokeOpacity={0.45} strokeWidth={u * 0.22} strokeLinecap="round" />
        <path d={`M ${u * 3.4} ${u * 3} q ${u * 0.7} ${-u * 0.6} ${u * 1.4} 0`} fill="none" stroke="#ffffff" strokeOpacity={0.3} strokeWidth={u * 0.18} strokeLinecap="round" />
      </pattern>
      <pattern id={`${prefix}paving`} width={u * 2.4} height={u * 2.4} patternUnits="userSpaceOnUse">
        <rect x={u * 0.2} y={u * 0.2} width={u * 1} height={u * 0.9} rx={u * 0.15} fill="#000000" fillOpacity={0.07} />
        <rect x={u * 1.4} y={u * 1.3} width={u * 0.8} height={u * 0.9} rx={u * 0.15} fill="#ffffff" fillOpacity={0.12} />
      </pattern>
      <pattern id={`${prefix}roof`} width={u * 1.3} height={u * 1.3} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={u * 0.25} height={u * 1.3} fill="#000000" fillOpacity={0.1} />
      </pattern>
      <radialGradient id={`${prefix}vignette`} cx="50%" cy="50%" r="72%">
        <stop offset="62%" stopColor="#000000" stopOpacity={0} />
        <stop offset="100%" stopColor="#000000" stopOpacity={0.14} />
      </radialGradient>
    </>
  );
}

/** Grass texture, soft patches, a darker edge and a hedge around the park. */
export function TerrainGround({ prefix, width, height, u }: { prefix: string; width: number; height: number; u: number }) {
  const rand = seeded(Math.round(width * 31 + height));
  const patches = Array.from({ length: 7 }, () => ({ x: rand() * width, y: rand() * height, rx: u * (18 + rand() * 30), ry: u * (12 + rand() * 22), dark: rand() > 0.5 }));
  return (
    <g pointerEvents="none">
      <clipPath id={`${prefix}park`}>
        <rect width={width} height={height} />
      </clipPath>
      <g clipPath={`url(#${prefix}park)`}>
        {patches.map((p, i) => (
          <ellipse key={i} cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill={p.dark ? 'var(--ground-shade)' : 'var(--ground-glow)'} />
        ))}
      </g>
      <rect width={width} height={height} fill={`url(#${prefix}grass)`} />
      <rect width={width} height={height} fill={`url(#${prefix}vignette)`} />
      <rect
        x={u * 0.6}
        y={u * 0.6}
        width={width - u * 1.2}
        height={height - u * 1.2}
        fill="none"
        stroke="var(--hedge)"
        strokeWidth={u * 1.3}
        strokeDasharray={`${u * 0.05} ${u * 1.45}`}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Shadows under buildings and rides, drawn below every shape. */
export function TerrainShadows({ shapes, u }: { shapes: DecorShape[]; u: number }) {
  return (
    <g className="map-shadows" pointerEvents="none" fill="#0f1a12" fillOpacity={0.2}>
      {shapes
        .filter((s) => !isLineKind(s.kind) && castsShadow(s.kind))
        .map((s, i) => (
          <polygon key={s.id ?? i} points={pointsAttr(s.points)} transform={`translate(${u * 0.55} ${u * 0.75})`} />
        ))}
    </g>
  );
}

/** What sits on top of one area: trees, ripples, paving, a roof, a coaster track or a ride. */
export function ShapeDecor({ shape, u, prefix }: { shape: DecorShape; u: number; prefix: string }) {
  if (isLineKind(shape.kind) || shape.kind === 'interest' || shape.kind === 'zone') return null;
  const d = decorFor(shape, u);
  const clip = `${prefix}clip${shape.id ?? seedOf(shape)}`;
  const dark = shade(shape.color, -0.32);
  const light = shade(shape.color, 0.28);
  return (
    <g pointerEvents="none" className="shape-decor">
      <clipPath id={clip}>
        <polygon points={pointsAttr(shape.points)} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <polygon points={pointsAttr(shape.points)} fill="none" stroke="#0f1a12" strokeOpacity={0.14} strokeWidth={u * 1.4} strokeLinejoin="round" />
        {WET.includes(shape.kind) && (
          <>
            <polygon points={pointsAttr(shape.points)} fill={`url(#${prefix}ripple)`} />
            <polygon points={pointsAttr(shape.points)} fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={u * 1.6} strokeLinejoin="round" />
          </>
        )}
        {shape.kind === 'path' && <polygon points={pointsAttr(shape.points)} fill={`url(#${prefix}paving)`} />}
        {d.rocks.map((r, i) => (
          <ellipse key={`r${i}`} cx={r.x} cy={r.y} rx={r.r * 1.3} ry={r.r} fill="#8d8a7e" stroke="#5f5c52" strokeWidth={u * 0.15} />
        ))}
        {d.trees.map((t, i) => (
          <g key={`t${i}`}>
            <circle cx={t.x + t.r * 0.25} cy={t.y + t.r * 0.35} r={t.r} fill="#0f1a12" fillOpacity={0.22} />
            <circle cx={t.x} cy={t.y} r={t.r} fill={TREE_GREENS[i % TREE_GREENS.length]} />
            <circle cx={t.x - t.r * 0.3} cy={t.y - t.r * 0.32} r={t.r * 0.45} fill="#ffffff" fillOpacity={0.16} />
          </g>
        ))}
        {d.roof && (
          <>
            <polygon points={pointsAttr(d.roof)} fill={`url(#${prefix}roof)`} stroke={light} strokeOpacity={0.7} strokeWidth={u * 0.3} strokeLinejoin="round" />
            {d.ridge && <line x1={d.ridge[0][0]} y1={d.ridge[0][1]} x2={d.ridge[1][0]} y2={d.ridge[1][1]} stroke={dark} strokeWidth={u * 0.45} strokeLinecap="round" />}
          </>
        )}
        {d.track && (
          <>
            <path d={d.track} fill="none" stroke={shape.kind === 'coaster' ? '#2b2f3a' : '#e8f6fb'} strokeOpacity={0.75} strokeWidth={u * 1.1} strokeLinejoin="round" />
            <path
              d={d.track}
              fill="none"
              stroke={shape.kind === 'coaster' ? '#f4efe6' : shade(shape.color, -0.35)}
              strokeWidth={u * 0.5}
              strokeDasharray={`${u * 0.25} ${u * 0.6}`}
            />
          </>
        )}
        {d.ride && (
          <g stroke={dark} strokeWidth={u * 0.35} fill="none">
            <circle cx={d.ride.x} cy={d.ride.y} r={d.ride.r} fill={light} fillOpacity={0.45} />
            <circle cx={d.ride.x} cy={d.ride.y} r={d.ride.r * 0.25} fill={dark} />
            {[0, 1, 2, 3, 4, 5].map((k) => {
              const a = (k * Math.PI) / 3;
              return <line key={k} x1={d.ride!.x} y1={d.ride!.y} x2={d.ride!.x + Math.cos(a) * d.ride!.r} y2={d.ride!.y + Math.sin(a) * d.ride!.r} />;
            })}
          </g>
        )}
      </g>
    </g>
  );
}
