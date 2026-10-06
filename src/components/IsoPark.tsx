import type { ReactNode } from 'react';

/**
 * A small isometric park for the landing page, drawn in code: a raised block of land with paths and a
 * plaza, a fenced savanna with a pond and elephants, a forest habitat, a roller coaster on supports,
 * a Ferris wheel, buildings with roofs, and guests on the paths. Everything is in world units
 * (x to the right-down, y to the left-down, z up) and painted back to front.
 */

type V3 = [number, number, number];

const U = 16; // pixels per world unit
const COS = Math.cos(Math.PI / 6);
const W = 24; // land size
const H = 18;

const P = (x: number, y: number, z = 0): [number, number] => [(x - y) * COS * U, (x + y) * 0.5 * U - z * U];

/** The drawing's view box: the land, its sides and the tallest ride. */
export const ISO_BOX = (() => {
  const minX = P(0, H)[0] - 8;
  const maxX = P(W, 0)[0] + 8;
  const minY = P(0, 0, 7)[1];
  const maxY = P(W, H, -1.2)[1] + 6;
  return { minX, minY, w: maxX - minX, h: maxY - minY };
})();

/** Where a world point (or a point in view-box units, with `raw`) lands, in percent of the drawing. */
export function isoPercent(p: V3 | [number, number], raw = false) {
  const [x, y] = raw ? (p as [number, number]) : P(...(p as V3));
  return { left: ((x - ISO_BOX.minX) / ISO_BOX.w) * 100, top: ((y - ISO_BOX.minY) / ISO_BOX.h) * 100 };
}

export type IsoV3 = V3;
/** A dashed leader line from something in the park to a card next to it. */
export interface IsoCallout {
  from: V3;
  /** The card's corner, in view-box units. */
  to: [number, number];
}
const pts = (list: V3[]) => list.map(([x, y, z]) => P(x, y, z).map((n) => n.toFixed(1)).join(',')).join(' ');

function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(Math.max(0, Math.min(255, amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('')}`;
}

/** Catmull-Rom through 3D points, closed, `per` samples per segment. */
function spline(ctrl: V3[], per: number): V3[] {
  const out: V3[] = [];
  const n = ctrl.length;
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n];
    const p1 = ctrl[i];
    const p2 = ctrl[(i + 1) % n];
    const p3 = ctrl[(i + 2) % n];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(
        [0, 1, 2].map(
          (j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3),
        ) as V3,
      );
    }
  }
  return out;
}

interface Item {
  d: number;
  el: ReactNode;
}

function box(key: string, x: number, y: number, w: number, dpt: number, h: number, wall: string): ReactNode {
  return (
    <g key={key}>
      <polygon points={pts([[x + w, y, 0], [x + w, y + dpt, 0], [x + w, y + dpt, h], [x + w, y, h]])} fill={shade(wall, -0.28)} />
      <polygon points={pts([[x, y + dpt, 0], [x + w, y + dpt, 0], [x + w, y + dpt, h], [x, y + dpt, h]])} fill={shade(wall, -0.12)} />
      <polygon points={pts([[x, y, h], [x + w, y, h], [x + w, y + dpt, h], [x, y + dpt, h]])} fill={wall} />
    </g>
  );
}

/** A box with a gabled roof whose ridge runs along x. */
function house(key: string, x: number, y: number, w: number, dpt: number, h: number, wall: string, roof: string, rise = 1): Item {
  const r = h + rise;
  return {
    d: x + y + (w + dpt) / 2,
    el: (
      <g key={key}>
        {box(`${key}b`, x, y, w, dpt, h, wall)}
        <polygon points={pts([[x, y, h], [x + w, y, h], [x + w, y + dpt / 2, r], [x, y + dpt / 2, r]])} fill={shade(roof, -0.25)} />
        <polygon points={pts([[x + w, y, h], [x + w, y + dpt, h], [x + w, y + dpt / 2, r]])} fill={shade(wall, -0.2)} />
        <polygon points={pts([[x, y + dpt, h], [x + w, y + dpt, h], [x + w, y + dpt / 2, r], [x, y + dpt / 2, r]])} fill={roof} />
        <polyline points={pts([[x, y + dpt / 2, r], [x + w, y + dpt / 2, r]])} stroke={shade(roof, -0.4)} strokeWidth={1.5} fill="none" />
      </g>
    ),
  };
}

function roundTree(key: string, x: number, y: number, size = 1, tint = '#4f8f46'): Item {
  const [bx, by] = P(x, y, 0);
  const [cx, cy] = P(x, y, 1.05 * size);
  const r = 0.62 * U * size;
  return {
    d: x + y,
    el: (
      <g key={key}>
        <line x1={bx} y1={by} x2={bx} y2={cy + r * 0.4} stroke="#6b4a2e" strokeWidth={2.4} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={r} fill={tint} />
        <circle cx={cx + r * 0.25} cy={cy + r * 0.25} r={r * 0.75} fill={shade(tint, -0.22)} opacity={0.55} />
        <circle cx={cx - r * 0.3} cy={cy - r * 0.32} r={r * 0.38} fill="#ffffff" opacity={0.22} />
      </g>
    ),
  };
}

function acacia(key: string, x: number, y: number): Item {
  const [bx, by] = P(x, y, 0);
  const [cx, cy] = P(x, y, 1.7);
  return {
    d: x + y,
    el: (
      <g key={key}>
        <path d={`M${bx} ${by} L${cx} ${cy + 4} M${cx} ${cy + 8} l-7 -6 M${cx} ${cy + 8} l7 -6`} stroke="#6b4a2e" strokeWidth={2.2} strokeLinecap="round" fill="none" />
        <ellipse cx={cx} cy={cy} rx={U * 0.95} ry={U * 0.34} fill="#7aa43f" />
        <ellipse cx={cx + 3} cy={cy + 2} rx={U * 0.8} ry={U * 0.22} fill="#5f8a30" opacity={0.6} />
      </g>
    ),
  };
}

function pine(key: string, x: number, y: number, size = 1): Item {
  const [bx, by] = P(x, y, 0);
  const [tx, ty] = P(x, y, 2 * size);
  const w = U * 0.55 * size;
  return {
    d: x + y,
    el: (
      <g key={key}>
        <line x1={bx} y1={by} x2={bx} y2={by - 6} stroke="#6b4a2e" strokeWidth={2.4} />
        <polygon points={`${tx},${ty} ${bx - w},${by - 5} ${bx + w},${by - 5}`} fill="#2f6b45" />
        <polygon points={`${tx},${ty} ${bx},${by - 5} ${bx + w},${by - 5}`} fill="#245638" />
      </g>
    ),
  };
}

function elephant(key: string, x: number, y: number, flip = false): Item {
  const [cx, cy] = P(x, y, 0.55);
  const s = flip ? -1 : 1;
  return {
    d: x + y,
    el: (
      <g key={key} transform={`translate(${cx} ${cy}) scale(${s} 1)`}>
        <ellipse cx={0} cy={13} rx={9} ry={3} fill="#000" opacity={0.18} />
        <rect x={-6} y={2} width={3} height={8} fill="#7d7a76" />
        <rect x={3} y={2} width={3} height={8} fill="#7d7a76" />
        <ellipse cx={0} cy={0} rx={9} ry={6} fill="#9a9792" />
        <circle cx={9} cy={-2} r={4.5} fill="#9a9792" />
        <path d="M12 0 q3 5 0 9" stroke="#9a9792" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <ellipse cx={7} cy={-2} rx={2.6} ry={3.6} fill="#85827d" />
      </g>
    ),
  };
}

function guest(key: string, x: number, y: number, shirt: string): Item {
  const [gx, gy] = P(x, y, 0);
  return {
    d: x + y,
    el: (
      <g key={key}>
        <ellipse cx={gx} cy={gy} rx={3} ry={1.2} fill="#000" opacity={0.2} />
        <rect x={gx - 1.8} y={gy - 7} width={3.6} height={6} rx={1.2} fill={shirt} />
        <circle cx={gx} cy={gy - 8.8} r={1.9} fill="#f1c9a5" />
      </g>
    ),
  };
}

function fence(key: string, poly: [number, number][]): Item[] {
  return poly.map(([x1, y1], i) => {
    const [x2, y2] = poly[(i + 1) % poly.length];
    return {
      d: (x1 + x2 + y1 + y2) / 2 - 0.2,
      el: (
        <g key={`${key}${i}`}>
          <polygon points={pts([[x1, y1, 0], [x2, y2, 0], [x2, y2, 0.45], [x1, y1, 0.45]])} fill="#a07b4f" opacity={0.35} />
          <polyline points={pts([[x1, y1, 0.45], [x2, y2, 0.45]])} stroke="#7a5a36" strokeWidth={1.6} fill="none" />
          <polyline points={pts([[x1, y1, 0.22], [x2, y2, 0.22]])} stroke="#7a5a36" strokeWidth={1} fill="none" />
        </g>
      ),
    };
  });
}

/** The coaster: track, supports and a car, cut into segments so trees and buildings overlap it correctly. */
function coaster(): Item[] {
  const track = spline(
    [
      [14.6, 6.2, 0.5],
      [17.0, 6.3, 0.6],
      [19.6, 6.1, 4.2],
      [21.4, 5.2, 1.0],
      [22.2, 3.4, 2.6],
      [21.0, 1.6, 1.4],
      [18.4, 1.6, 3.3],
      [16.0, 2.2, 1.2],
      [14.4, 3.8, 1.8],
      [14.0, 5.4, 0.7],
    ],
    9,
  );
  const items: Item[] = [];
  track.forEach((a, i) => {
    const b = track[(i + 1) % track.length];
    const [ax, ay] = P(...a);
    const [bx, by] = P(...b);
    const [gx, gy] = P(a[0], a[1], 0);
    items.push({
      d: (a[0] + a[1] + b[0] + b[1]) / 2,
      el: (
        <g key={`c${i}`}>
          {i % 2 === 0 && a[2] > 0.7 && <line x1={gx} y1={gy} x2={ax} y2={ay} stroke="#8d98a8" strokeWidth={1.4} />}
          <line x1={ax} y1={ay + 2.5} x2={bx} y2={by + 2.5} stroke="#b03a3a" strokeWidth={2.2} strokeLinecap="round" />
          <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#ef5a4f" strokeWidth={3.2} strokeLinecap="round" />
        </g>
      ),
    });
  });
  // the car, on the drop
  const at = track[30];
  const next = track[31];
  const [cx, cy] = P(...at);
  const [nx, ny] = P(...next);
  const angle = (Math.atan2(ny - cy, nx - cx) * 180) / Math.PI;
  items.push({
    d: at[0] + at[1] + 0.1,
    el: (
      <g key="car" transform={`translate(${cx} ${cy - 4}) rotate(${angle})`}>
        <rect x={-9} y={-5} width={18} height={7} rx={2} fill="#0a2239" />
        <rect x={-6} y={-8} width={4} height={4} rx={1} fill="#dceab2" />
        <rect x={1} y={-8} width={4} height={4} rx={1} fill="#a8ccc9" />
      </g>
    ),
  });
  return items;
}

/** A Ferris wheel standing in the x-z plane. */
function ferrisWheel(cx: number, cy: number): Item {
  const R = 2.6;
  const zc = 3.4;
  const rim: V3[] = Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2;
    return [cx + Math.cos(a) * R, cy, zc + Math.sin(a) * R];
  });
  const cars = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2);
  const [hx, hy] = P(cx, cy, zc);
  const colors = ['#dceab2', '#a8ccc9', '#ff4d8d', '#f2b84b'];
  return {
    d: cx + cy,
    el: (
      <g key="wheel">
        <polygon points={pts([[cx - 1.4, cy, 0], [cx, cy, zc], [cx - 0.9, cy, 0]])} fill="#5e6b7d" />
        <polygon points={pts([[cx + 1.4, cy, 0], [cx, cy, zc], [cx + 0.9, cy, 0]])} fill="#738196" />
        {cars.map((a, i) => {
          const [sx, sy] = P(cx + Math.cos(a) * R, cy, zc + Math.sin(a) * R);
          return <line key={`s${i}`} x1={hx} y1={hy} x2={sx} y2={sy} stroke="#c7cfdb" strokeWidth={1} />;
        })}
        <polygon points={pts(rim)} fill="none" stroke="#e8edf3" strokeWidth={2.6} />
        <polygon points={pts(rim)} fill="none" stroke="#9aa6b6" strokeWidth={1} />
        {cars.map((a, i) => {
          const [gx, gy] = P(cx + Math.cos(a) * R, cy, zc + Math.sin(a) * R);
          return <rect key={`g${i}`} x={gx - 3.5} y={gy} width={7} height={6} rx={1.5} fill={colors[i % colors.length]} />;
        })}
        <circle cx={hx} cy={hy} r={3} fill="#0a2239" />
      </g>
    ),
  };
}

function flat(key: string, list: [number, number][], fill: string, z = 0.01, extra?: Record<string, string | number>) {
  return <polygon key={key} points={pts(list.map(([x, y]) => [x, y, z]))} fill={fill} {...extra} />;
}

export function IsoPark({ className, callouts = [] }: { className?: string; callouts?: IsoCallout[] }) {
  const savanna: [number, number][] = [
    [1.2, 1.2],
    [9.6, 1.0],
    [10.0, 6.8],
    [5.0, 7.4],
    [1.0, 6.6],
  ];
  const forest: [number, number][] = [
    [1.2, 10.6],
    [9.8, 10.4],
    [10.2, 16.8],
    [1.0, 16.9],
  ];

  const items: Item[] = [
    ...fence('fs', savanna),
    ...fence('ff', forest),
    acacia('a1', 2.6, 2.4),
    acacia('a2', 7.8, 2.0),
    acacia('a3', 8.8, 5.6),
    roundTree('t0', 2.0, 5.8, 0.8, '#6f9a3d'),
    elephant('e1', 4.6, 5.0),
    elephant('e2', 6.2, 5.6, true),
    elephant('e3', 7.0, 3.6),
    ...[
      [2.2, 11.6], [3.8, 11.3], [5.6, 11.9], [7.6, 11.4], [9.0, 12.4], [2.6, 13.4], [4.4, 13.8], [6.4, 13.1], [8.4, 14.2],
      [2.0, 15.6], [3.6, 16.1], [5.4, 15.4], [7.0, 16.0], [9.2, 15.8],
    ].map(([x, y], i) => (i % 3 === 2 ? pine(`p${i}`, x, y, 0.9) : roundTree(`f${i}`, x, y, 0.85 + (i % 2) * 0.2, ['#4f8f46', '#3f7a3d', '#5d9a50'][i % 3]))),
    house('hut', 4.6, 12.2, 1.6, 1.4, 0.9, '#c9a678', '#7a5a36', 0.7),
    house('station', 14.2, 5.0, 2.0, 1.6, 0.9, '#f2ead8', '#0a2239', 0.6),
    ...coaster(),
    ferrisWheel(18.6, 13.6),
    house('visitor', 14.0, 10.8, 2.8, 2.0, 1.4, '#f2ead8', '#60712f', 0.9),
    house('shop', 20.2, 10.8, 2.2, 1.6, 1.0, '#ffffff', '#ff4d8d', 0.8),
    house('wc', 21.4, 15.2, 1.6, 1.4, 0.9, '#e7eef0', '#3f7a8f', 0.6),
    {
      d: 15.4 + 15.6,
      el: (() => {
        const [qx, qy] = P(17.2, 16.6, 1.4);
        const [bx, by] = P(17.2, 16.6, 0);
        return (
          <g key="idea">
            <line x1={bx} y1={by} x2={qx} y2={qy + 6} stroke="#7a5a36" strokeWidth={1.6} />
            <rect x={qx - 9} y={qy - 9} width={18} height={15} rx={3} fill="#dceab2" stroke="#60712f" strokeWidth={1.2} />
            <text x={qx} y={qy + 3} textAnchor="middle" fontSize={11} fontWeight={800} fill="#0a2239">
              ?
            </text>
          </g>
        );
      })(),
    },
    roundTree('d3', 22.6, 13.0, 0.9),
    roundTree('d4', 23.0, 17.0, 1.1),
    roundTree('b1', 22.6, 1.2, 0.9),
    roundTree('b2', 13.6, 1.0, 0.8),
    ...[
      [11.6, 3.0, '#ff4d8d'], [11.9, 5.6, '#dceab2'], [11.4, 13.0, '#a8ccc9'], [12.0, 15.8, '#f2b84b'], [4.0, 8.6, '#0a2239'],
      [7.6, 9.0, '#ff4d8d'], [16.4, 8.5, '#a8ccc9'], [19.6, 9.1, '#f2b84b'], [22.4, 8.6, '#dceab2'], [13.6, 9.6, '#ef5a4f'],
      [10.4, 7.4, '#3f7a8f'],
    ].map(([x, y, c], i) => guest(`g${i}`, x as number, y as number, c as string)),
  ].sort((a, b) => a.d - b.d);

  const { minX, minY, w: vw, h: vh } = ISO_BOX;
  const maxX = minX + vw;

  return (
    <svg className={className} viewBox={`${minX} ${minY} ${vw} ${vh}`} aria-hidden="true">
      <defs>
        <linearGradient id="iso-grass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a9cf73" />
          <stop offset="1" stopColor="#8dbb5c" />
        </linearGradient>
        <linearGradient id="iso-water" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7cc6e6" />
          <stop offset="1" stopColor="#3f97c4" />
        </linearGradient>
      </defs>

      {/* the block of land */}
      <ellipse cx={P(W / 2, H / 2)[0]} cy={P(W, H)[1] + 4} rx={(maxX - minX) * 0.42} ry={22} fill="#000" opacity={0.28} />
      <polygon points={pts([[W, 0, 0], [W, H, 0], [W, H, -1.1], [W, 0, -1.1]])} fill="#6d4c2f" />
      <polygon points={pts([[0, H, 0], [W, H, 0], [W, H, -1.1], [0, H, -1.1]])} fill="#8a6440" />
      <polygon points={pts([[W, 0, -0.35], [W, H, -0.35], [W, H, -0.45], [W, 0, -0.45]])} fill="#5a3e26" opacity={0.6} />
      <polygon points={pts([[0, H, -0.35], [W, H, -0.35], [W, H, -0.45], [0, H, -0.45]])} fill="#6d4c2f" opacity={0.6} />
      <polygon points={pts([[0, 0, 0], [W, 0, 0], [W, H, 0], [0, H, 0]])} fill="url(#iso-grass)" />
      <polygon points={pts([[0, H, 0], [W, H, 0], [W, H, -0.12], [0, H, -0.12]])} fill="#5f8f3a" />
      <polygon points={pts([[W, 0, 0], [W, H, 0], [W, H, -0.12], [W, 0, -0.12]])} fill="#4f7c30" />

      {/* ground: habitats, paths, plaza and water */}
      {flat('sav', savanna, '#dcc489')}
      {flat('for', forest, '#7fb05a')}
      {flat('pond', [[3.0, 2.6], [5.6, 2.2], [6.4, 3.6], [5.0, 4.4], [3.2, 4.0]], 'url(#iso-water)', 0.02)}
      {flat('pond-rim', [[3.0, 2.6], [5.6, 2.2], [6.4, 3.6], [5.0, 4.4], [3.2, 4.0]], 'none', 0.02, { stroke: '#e9f6fb', strokeWidth: 1.4, strokeOpacity: 0.7 })}
      {flat('stream', [[6.0, 13.8], [9.8, 13.4], [9.9, 14.0], [6.2, 14.4]], 'url(#iso-water)', 0.02)}
      {flat('path-x', [[0, 8.2], [W, 8.2], [W, 9.8], [0, 9.8]], '#ecdcb0', 0.015)}
      {flat('path-y', [[11.0, 0], [12.6, 0], [12.6, H], [11.0, H]], '#ecdcb0', 0.015)}
      {flat('plaza', [[9.8, 7.2], [13.8, 7.2], [13.8, 10.8], [9.8, 10.8]], '#f3e7c4', 0.02)}
      {flat('fountain', [[11.0, 8.4], [12.6, 8.4], [12.6, 9.6], [11.0, 9.6]], 'url(#iso-water)', 0.03, { stroke: '#d8c9a0', strokeWidth: 2 })}
      {(() => {
        const [fx, fy] = P(11.8, 9.0, 0.03);
        return <path d={`M${fx} ${fy} q-4 -10 -8 -2 M${fx} ${fy} q4 -10 8 -2 M${fx} ${fy} l0 -12`} stroke="#ffffff" strokeWidth={1.6} fill="none" opacity={0.9} />;
      })()}
      {flat('coaster-ground', [[13.4, 0.8], [23.2, 0.8], [23.2, 7.2], [13.4, 7.2]], '#9cc56a', 0.012)}
      {flat('idea-plot', [[15.2, 15.4], [19.2, 15.4], [19.2, 17.6], [15.2, 17.6]], '#c9b27a', 0.02, {
        fillOpacity: 0.55,
        stroke: '#60712f',
        strokeWidth: 1.6,
        strokeDasharray: '5 4',
      })}

      {/* objects, back to front */}
      {items.map((i) => i.el)}

      {/* leader lines to the cards around the park */}
      {callouts.map(({ from, to }, i) => {
        const [fx, fy] = P(...from);
        return (
          <g key={`co${i}`} className="iso-callout">
            <path d={`M${fx} ${fy} L${to[0]} ${to[1]}`} fill="none" stroke="#a8ccc9" strokeWidth={1.4} strokeDasharray="4 4" />
            <circle cx={fx} cy={fy} r={6} fill="#a8ccc9" opacity={0.35} />
            <circle cx={fx} cy={fy} r={3} fill="#dceab2" stroke="#0a2239" strokeWidth={1} />
            <circle cx={to[0]} cy={to[1]} r={2.4} fill="#a8ccc9" />
          </g>
        );
      })}
    </svg>
  );
}
