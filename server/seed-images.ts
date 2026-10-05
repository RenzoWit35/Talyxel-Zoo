import { crc32, deflateSync } from 'node:zlib';
import type { Biome } from '../shared/constants';

/**
 * Procedurally painted landscape "postcards" used as demo photos, so the seed
 * data has pictures without shipping or downloading any real images.
 */

type RGB = [number, number, number];

interface Palette {
  skyTop: RGB;
  skyBottom: RGB;
  sun: RGB;
  hills: [RGB, RGB, RGB];
  trees: RGB;
  treeShape: 'round' | 'pine' | 'acacia' | 'none';
  water?: RGB;
}

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const PALETTES: Record<Exclude<Biome, ''>, Palette> = {
  grassland: {
    skyTop: hex('#f2c48d'),
    skyBottom: hex('#fbe8c8'),
    sun: hex('#fff3c4'),
    hills: [hex('#d8b46a'), hex('#c49a45'), hex('#9c7a33')],
    trees: hex('#5b5a2c'),
    treeShape: 'acacia',
  },
  tropical: {
    skyTop: hex('#a9d8d4'),
    skyBottom: hex('#e4f3e6'),
    sun: hex('#fffbe0'),
    hills: [hex('#6fae7c'), hex('#3f8a57'), hex('#235c3c')],
    trees: hex('#1d4a30'),
    treeShape: 'round',
  },
  temperate: {
    skyTop: hex('#b9dcf2'),
    skyBottom: hex('#eef6fb'),
    sun: hex('#fffbe8'),
    hills: [hex('#a6cf86'), hex('#77a956'), hex('#4d7e3b')],
    trees: hex('#355f2c'),
    treeShape: 'round',
  },
  taiga: {
    skyTop: hex('#c3d6ea'),
    skyBottom: hex('#eef3f8'),
    sun: hex('#ffffff'),
    hills: [hex('#dfe8ee'), hex('#9eb4c3'), hex('#5f7a6c')],
    trees: hex('#2b4a3b'),
    treeShape: 'pine',
  },
  tundra: {
    skyTop: hex('#b6cde4'),
    skyBottom: hex('#f1f5f9'),
    sun: hex('#ffffff'),
    hills: [hex('#f4f7fa'), hex('#d6e0e8'), hex('#a9bccb')],
    trees: hex('#4c6658'),
    treeShape: 'none',
  },
  desert: {
    skyTop: hex('#efbd8a'),
    skyBottom: hex('#fde5c3'),
    sun: hex('#fff6d6'),
    hills: [hex('#e8b77a'), hex('#d39a59'), hex('#b97a3c')],
    trees: hex('#6a6b3a'),
    treeShape: 'none',
  },
  aquatic: {
    skyTop: hex('#a9d6ef'),
    skyBottom: hex('#e7f5fc'),
    sun: hex('#ffffff'),
    hills: [hex('#bcd9c2'), hex('#e8d6ac'), hex('#d9c18e')],
    trees: hex('#3a6d4a'),
    treeShape: 'round',
    water: hex('#3f8fc2'),
  },
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * stride + 1);
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function paintPostcard(biome: Biome, seed: number, width = 640, height = 420): Buffer {
  const p = PALETTES[biome || 'temperate'];
  const r = rng(seed);
  const horizon = height * (0.42 + r() * 0.12);
  const sun = { x: width * (0.15 + r() * 0.7), y: height * (0.1 + r() * 0.16), r: 18 + r() * 16 };
  const hills = p.hills.map((color, i) => ({
    color,
    base: horizon + i * height * 0.13,
    amp: height * (0.05 + r() * 0.05) * (1 - i * 0.2),
    f1: (0.004 + r() * 0.006) * (1 + i * 0.4),
    f2: 0.013 + r() * 0.01,
    ph: r() * 10,
  }));
  const hillY = (h: (typeof hills)[number], x: number) => h.base - h.amp * Math.sin(x * h.f1 + h.ph) - h.amp * 0.35 * Math.sin(x * h.f2 + h.ph * 2);
  const trees =
    p.treeShape === 'none'
      ? []
      : Array.from({ length: 4 + Math.floor(r() * 6) }, () => {
          const layer = 1 + Math.floor(r() * 2);
          const x = r() * width;
          const scale = layer === 2 ? 1.5 : 1;
          return { x, y: hillY(hills[layer], x) + 4, h: (36 + r() * 30) * scale, w: (22 + r() * 18) * scale, layer };
        });
  const waterLine = p.water ? height * (0.7 + r() * 0.08) : Infinity;

  const px = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let c = mix(p.skyTop, p.skyBottom, Math.min(1, y / horizon));
      const d = Math.hypot(x - sun.x, y - sun.y);
      if (d < sun.r) c = p.sun;
      else if (d < sun.r * 3.2) c = mix(c, p.sun, 0.35 * (1 - (d - sun.r) / (sun.r * 2.2)) ** 2);

      hills.forEach((h, i) => {
        const top = hillY(h, x);
        if (y >= top) c = mix(h.color, [0, 0, 0], Math.min(0.18, (y - top) / height) * 0.6);
        for (const t of trees) {
          if (t.layer !== i) continue;
          const dx = x - t.x;
          const dy = t.y - y;
          let hit = false;
          if (p.treeShape === 'pine') hit = dy > 0 && dy < t.h && Math.abs(dx) < (t.w / 2) * (1 - dy / t.h);
          else if (p.treeShape === 'round') hit = Math.hypot(dx / t.w, (dy - t.h * 0.62) / (t.h * 0.42)) < 0.62 || (Math.abs(dx) < 3 && dy > 0 && dy < t.h * 0.4);
          else if (p.treeShape === 'acacia')
            hit = (Math.abs(dx) < t.w * 1.1 && Math.abs(dy - t.h * 0.85) < t.h * 0.1 * (1 - (dx / (t.w * 1.1)) ** 2)) || (Math.abs(dx - dy * 0.12) < 2.5 && dy > 0 && dy < t.h * 0.8);
          if (hit) c = mix(p.trees, [0, 0, 0], i * 0.08);
        }
      });

      if (p.water && y > waterLine) {
        const ripple = Math.sin(x * 0.08 + y * 0.5) * Math.sin(y * 0.9) > 0.85 ? 0.35 : 0;
        c = mix(mix(p.water, [20, 60, 90], (y - waterLine) / (height - waterLine) * 0.5), [255, 255, 255], ripple);
      }

      // soft vignette
      const vx = x / width - 0.5;
      const vy = y / height - 0.5;
      c = mix(c, [20, 25, 20], Math.max(0, (vx * vx + vy * vy) * 0.55 - 0.03));

      const o = (y * width + x) * 3;
      px[o] = c[0];
      px[o + 1] = c[1];
      px[o + 2] = c[2];
    }
  }
  return encodePng(width, height, px);
}
