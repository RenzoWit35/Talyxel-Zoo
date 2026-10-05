import { PawPrint, RollerCoaster } from 'lucide-react';
import { PARK_TYPES, type ParkType } from '../../shared/constants';
import { parkMeta } from '../../shared/parks';

const ICONS = { zoo: PawPrint, theme_park: RollerCoaster } satisfies Record<ParkType, unknown>;

export function ParkIcon({ type, size = 16 }: { type: ParkType; size?: number }) {
  const Icon = ICONS[type] ?? PawPrint;
  return <Icon size={size} />;
}

/** Small chip naming the game a plan is for. */
export function ParkBadge({ type }: { type: ParkType }) {
  return (
    <span className={`chip park-badge park-${type}`}>
      <ParkIcon type={type} size={13} /> {parkMeta(type).game}
    </span>
  );
}

/** Big two-option picker: Zoo (Planet Zoo) or Theme park (Planet Coaster). */
export function ParkTypePicker({ value, onChange }: { value: ParkType; onChange: (type: ParkType) => void }) {
  return (
    <div className="park-picker" role="radiogroup" aria-label="Park type">
      {PARK_TYPES.map((t) => {
        const meta = parkMeta(t);
        return (
          <button type="button" key={t} role="radio" aria-checked={value === t} className={`park-option park-${t}`} onClick={() => onChange(t)}>
            <span className="park-option-icon">
              <ParkIcon type={t} size={22} />
            </span>
            <span>
              <strong>{meta.label}</strong>
              <span className="subtle">{meta.game}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
