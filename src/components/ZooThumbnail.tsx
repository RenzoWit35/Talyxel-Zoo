import { useId } from 'react';
import { isLineKind, type HabitatKind } from '../../shared/constants';
import type { Point } from '../../shared/geometry';
import type { ZooShape } from '../../shared/types';
import { shade } from '../lib/color';
import { drawOrder, pointsAttr } from '../lib/shapes';
import { ShapeDecor, TerrainDefs, TerrainGround, TerrainShadows, terrainUnit } from './map/terrain';

interface Props {
  width: number;
  height: number;
  shapes: ZooShape[];
  /** Outline one shape and fade the rest. */
  highlight?: { points: Point[]; kind: HabitatKind };
  className?: string;
  /** How the map fills its box: crop to fill (default) or show the whole map. */
  fit?: 'slice' | 'meet';
}

/** Static top-down preview of a park plan. */
export function ZooThumbnail({ width, height, shapes, highlight, className = 'zoo-thumb', fit = 'slice' }: Props) {
  const id = useId().replace(/:/g, '');
  const size = Math.max(width, height);
  const grid = Math.max(10, Math.round(size / 12 / 10) * 10);
  const fade = highlight ? 0.45 : 1;
  const u = terrainUnit(width, height);
  const sorted = [...shapes].sort(drawOrder);
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio={`xMidYMid ${fit}`} aria-hidden="true">
      <defs>
        <pattern id={`g${id}`} width={grid} height={grid} patternUnits="userSpaceOnUse">
          <path d={`M ${grid} 0 L 0 0 0 ${grid}`} fill="none" stroke="var(--ground-line)" strokeWidth={size / 400} />
        </pattern>
        <TerrainDefs prefix={`t${id}`} u={u} />
      </defs>
      <rect width={width} height={height} fill="var(--ground)" />
      <TerrainGround prefix={`t${id}`} width={width} height={height} u={u} />
      <rect width={width} height={height} fill={`url(#g${id})`} />
      <g opacity={fade}>
        <TerrainShadows shapes={sorted} u={u} />
      </g>
      {sorted.map((s, i) =>
        isLineKind(s.kind) ? (
          <g key={i} opacity={fade}>
            <polyline points={pointsAttr(s.points)} fill="none" stroke={shade(s.color, -0.45)} strokeWidth={size / 110} strokeLinejoin="round" strokeLinecap="round" />
            <polyline
              points={pointsAttr(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={size / 190}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={`${size / 70} ${size / 140}`}
            />
          </g>
        ) : (
          <g key={i}>
            <polygon
              points={pointsAttr(s.points)}
              fill={s.color}
              fillOpacity={(s.kind === 'path' ? 0.75 : s.kind === 'interest' ? 0.35 : 0.85) * fade}
              stroke={shade(s.color, -0.35)}
              strokeWidth={size / 250}
              strokeDasharray={s.kind === 'interest' ? `${size / 90} ${size / 160}` : undefined}
              strokeLinejoin="round"
            />
            <g opacity={fade}>
              <ShapeDecor shape={s} u={u} prefix={`t${id}`} />
            </g>
          </g>
        ),
      )}
      {highlight &&
        (isLineKind(highlight.kind) ? (
          <polyline
            points={pointsAttr(highlight.points)}
            fill="none"
            stroke="#fff"
            strokeWidth={size / 70}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,.35))' }}
          />
        ) : (
          <polygon
            points={pointsAttr(highlight.points)}
            fill="none"
            stroke="#fff"
            strokeWidth={size / 70}
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,.35))' }}
          />
        ))}
    </svg>
  );
}
