import { Eye, EyeOff } from 'lucide-react';
import { KIND_META, type HabitatKind } from '../../../shared/constants';
import type { Habitat } from '../../../shared/types';
import { KindIcon } from '../KindIcon';

interface Props {
  kinds: readonly HabitatKind[];
  habitats: Pick<Habitat, 'kind'>[];
  hidden: ReadonlySet<HabitatKind>;
  onChange: (hidden: Set<HabitatKind>) => void;
  /** 'list' for the planner's layers menu, 'chips' for the legend under a public map. */
  variant?: 'list' | 'chips';
}

/** Show or hide shape types on a map. Only types the map actually uses are listed. */
export function LayerToggles({ kinds, habitats, hidden, onChange, variant = 'list' }: Props) {
  const counts = new Map<HabitatKind, number>();
  for (const h of habitats) counts.set(h.kind, (counts.get(h.kind) ?? 0) + 1);
  const used = kinds.filter((k) => counts.has(k));
  const toggle = (k: HabitatKind) => {
    const next = new Set(hidden);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onChange(next);
  };

  if (variant === 'chips') {
    return (
      <div className="layer-chips" role="group" aria-label="Show on the map">
        {used.map((k) => (
          <button
            key={k}
            type="button"
            className="layer-chip"
            aria-pressed={!hidden.has(k)}
            onClick={() => toggle(k)}
            title={hidden.has(k) ? `Show ${KIND_META[k].label.toLowerCase()}` : `Hide ${KIND_META[k].label.toLowerCase()}`}
            style={{ ['--c' as string]: KIND_META[k].color }}
          >
            <KindIcon kind={k} />
            {KIND_META[k].label}
            <span className="count">{counts.get(k)}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="layer-list">
      {used.length === 0 && <p className="subtle">Nothing on the map yet.</p>}
      {used.map((k) => (
        <label key={k} className="layer-row">
          <input type="checkbox" checked={!hidden.has(k)} onChange={() => toggle(k)} />
          <span className="layer-swatch" style={{ ['--c' as string]: KIND_META[k].color }}>
            <KindIcon kind={k} />
          </span>
          <span className="spacer">{KIND_META[k].label}</span>
          <span className="subtle">{counts.get(k)}</span>
          {hidden.has(k) ? <EyeOff className="layer-eye" /> : <Eye className="layer-eye" />}
        </label>
      ))}
      {hidden.size > 0 && (
        <button type="button" className="btn btn-sm btn-block" onClick={() => onChange(new Set())}>
          Show everything
        </button>
      )}
    </div>
  );
}
