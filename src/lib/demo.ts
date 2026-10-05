import type { ZooShape } from '../../shared/types';

/** A small example zoo (300 × 200 m) for illustrations on the landing page, welcome dialog and guide. */
export const DEMO_SHAPES: ZooShape[] = [
  { kind: 'path', color: '#bfa98a', points: [[0, 92], [300, 92], [300, 108], [0, 108]] },
  { kind: 'path', color: '#bfa98a', points: [[142, 0], [158, 0], [158, 200], [142, 200]] },
  { kind: 'habitat', color: '#c79a3c', points: [[12, 10], [128, 12], [134, 80], [60, 84], [14, 70]] },
  { kind: 'water', color: '#4c98cc', points: [[70, 40], [100, 34], [112, 54], [86, 66], [66, 58]] },
  { kind: 'habitat', color: '#5f9e5c', points: [[170, 12], [288, 10], [290, 82], [172, 80]] },
  { kind: 'habitat', color: '#3e7a5a', points: [[14, 120], [128, 118], [130, 190], [70, 192], [16, 176]] },
  { kind: 'utility', color: '#64748b', points: [[172, 122], [214, 122], [214, 152], [172, 152]] },
  { kind: 'exhibit', color: '#d9733f', points: [[226, 120], [288, 122], [286, 188], [228, 186]] },
  { kind: 'scenery', color: '#93b85c', points: [[172, 162], [214, 162], [214, 190], [172, 190]] },
  { kind: 'interest', color: '#d6517d', points: [[226, 30], [270, 30], [270, 64], [226, 64]] },
  { kind: 'route', color: '#e0a526', points: [[20, 100], [96, 100], [120, 112], [150, 100], [230, 100], [250, 50]] },
];
