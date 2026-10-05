import { forwardRef } from 'react';
import { MousePointerClick } from 'lucide-react';
import { BIOME_LABELS, KIND_META, STATUS_META } from '../../../shared/constants';
import type { Habitat } from '../../../shared/types';
import { shade } from '../../lib/color';
import { plural } from '../../lib/format';
import { shapeFacts } from '../../lib/shapes';
import { KindIcon } from '../KindIcon';

export function StatusChip({ status }: { status: Habitat['status'] }) {
  return (
    <span className="chip chip-dot" style={{ ['--dot' as string]: STATUS_META[status].color }}>
      {STATUS_META[status].label}
    </span>
  );
}

/** Photo collection + key facts, shown while hovering a shape on the map. */
export const HoverCard = forwardRef<HTMLDivElement, { habitat: Habitat; hint?: string }>(function HoverCard({ habitat, hint }, ref) {
  const photos = habitat.photos.slice(0, 4);
  const extra = habitat.photos.length - photos.length;
  return (
    <div className="hover-card" ref={ref} role="tooltip">
      {photos.length ? (
        <div className="hover-photos" data-count={photos.length}>
          {photos.map((p, i) => (
            <div key={p.id} className="hover-photo">
              <img src={p.url} alt={p.caption} />
              {i === photos.length - 1 && extra > 0 && <span className="photo-more">+{extra}</span>}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="hover-photos hover-photos-empty"
          style={{ background: `linear-gradient(135deg, ${shade(habitat.color, 0.25)}, ${shade(habitat.color, -0.2)})` }}
        >
          <KindIcon kind={habitat.kind} />
          <span>No photos yet</span>
        </div>
      )}
      <div className="hover-body">
        <div className="hover-title">
          <span className="swatch-dot" style={{ background: habitat.color }} />
          <strong>{habitat.name}</strong>
        </div>
        {habitat.species && <div className="species">{habitat.species}</div>}
        <div className="row row-wrap" style={{ gap: 5 }}>
          <StatusChip status={habitat.status} />
          <span className="chip">{KIND_META[habitat.kind].label}</span>
          {habitat.biome && <span className="chip">{BIOME_LABELS[habitat.biome]}</span>}
        </div>
        <div className="hover-stats">
          {shapeFacts(habitat).map((f) => (
            <span key={f.label}>
              <small>{f.label}</small>
              {f.value}
            </span>
          ))}
          <span>
            <small>Photos</small>
            {habitat.photos.length}
          </span>
        </div>
        {habitat.description && <p className="hover-desc clamp-3">{habitat.description}</p>}
        <div className="hover-hint">
          <MousePointerClick size={13} /> {hint ?? (habitat.photos.length ? `Click to see all ${plural(habitat.photos.length, 'photo')}` : 'Click for details')}
        </div>
      </div>
    </div>
  );
});
