import { Lock, Vote } from 'lucide-react';
import { Link } from 'react-router';
import { HABITAT_KINDS, isLineKind, KIND_META } from '../../shared/constants';
import { formatLength, polylineLength } from '../../shared/geometry';
import type { ZooSummary } from '../../shared/types';
import { plural, timeAgo } from '../lib/format';
import { ParkBadge } from './ParkType';
import { ZooThumbnail } from './ZooThumbnail';

/** A park shown by its top-down plan (the whole map, never cropped), for the parks section on profiles. */
export function ParkMapCard({ zoo, editable }: { zoo: ZooSummary; editable?: boolean }) {
  const href = editable || zoo.status === 'draft' ? `/zoos/${zoo.id}/edit` : `/z/${zoo.id}`;
  const present = new Set(zoo.shapes.map((s) => s.kind));
  const kinds = HABITAT_KINDS.filter((k) => present.has(k));
  const routes = zoo.shapes.filter((s) => isLineKind(s.kind)).reduce((sum, s) => sum + polylineLength(s.points), 0);
  return (
    <Link to={href} className="park-map-card card" aria-label={`${zoo.title} — open the map`}>
      <div className="park-map-frame">
        <ZooThumbnail width={zoo.width} height={zoo.height} shapes={zoo.shapes} fit="meet" className="park-map-svg" />
        <div className="park-map-badges">
          <ParkBadge type={zoo.parkType} />
          {zoo.status === 'draft' && (
            <span className="chip">
              <Lock /> Draft
            </span>
          )}
          {zoo.hasOpenSurvey && (
            <span className="chip chip-accent">
              <Vote /> Survey open
            </span>
          )}
        </div>
        <span className="park-map-size">
          {zoo.width} × {zoo.height} m
        </span>
      </div>
      <div className="park-map-body">
        <h3>{zoo.title}</h3>
        <p className="park-map-meta">
          <span>{plural(zoo.habitatCount, 'area')}</span>
          {routes > 0 && <span>{formatLength(routes)} of walk routes</span>}
          {zoo.guests !== null && <span>{zoo.guests.toLocaleString('en')} guests</span>}
          <span className="subtle">{zoo.publishedAt ? `published ${timeAgo(zoo.publishedAt)}` : `edited ${timeAgo(zoo.updatedAt)}`}</span>
        </p>
        {kinds.length > 0 && (
          <div className="park-map-legend" aria-label="On the map">
            {kinds.slice(0, 6).map((k) => (
              <span key={k}>
                <i style={{ ['--c' as string]: KIND_META[k].color }} />
                {KIND_META[k].label}
              </span>
            ))}
            {kinds.length > 6 && <span className="subtle">+{kinds.length - 6} more</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
