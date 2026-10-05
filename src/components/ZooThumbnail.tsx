import { useId } from 'react';
import type { Point } from '../../shared/geometry';
import type { ZooShape } from '../../shared/types';
import { shade } from '../lib/color';
import { drawOrder } from '../lib/shapes';

interface Props {
  width: number;
  height: number;
  shapes: ZooShape[];
  /** Outline one shape and fade the rest. */
  highlight?: Point[];
  className?: string;
}

/** Static top-down preview of a zoo plan. */
export function ZooThumbnail({ width, height, shapes, highlight, className = 'zoo-thumb' }: Props) {
  const id = useId().replace(/:/g, '');
  const grid = Math.max(10, Math.round(Math.max(width, height) / 12 / 10) * 10);
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id={`g${id}`} width={grid} height={grid} patternUnits="userSpaceOnUse">
          <path d={`M ${grid} 0 L 0 0 0 ${grid}`} fill="none" stroke="var(--ground-line)" strokeWidth={Math.max(width, height) / 400} />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="var(--ground)" />
      <rect width={width} height={height} fill={`url(#g${id})`} />
      {[...shapes].sort(drawOrder).map((s, i) => (
        <polygon
          key={i}
          points={s.points.map((p) => p.join(',')).join(' ')}
          fill={s.color}
          fillOpacity={(s.kind === 'path' ? 0.75 : 0.85) * (highlight ? 0.45 : 1)}
          stroke={shade(s.color, -0.35)}
          strokeWidth={Math.max(width, height) / 250}
          strokeLinejoin="round"
        />
      ))}
      {highlight && (
        <polygon
          points={highlight.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke="#fff"
          strokeWidth={Math.max(width, height) / 70}
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,.35))' }}
        />
      )}
    </svg>
  );
}
