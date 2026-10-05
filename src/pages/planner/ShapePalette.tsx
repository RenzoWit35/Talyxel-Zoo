import { KIND_META, type HabitatKind } from '../../../shared/constants';
import { KindIcon } from '../../components/KindIcon';

interface Props {
  kinds: readonly HabitatKind[];
  /** The kind being drawn right now, or null when no drawing tool is active. */
  active: HabitatKind | null;
  onPick: (kind: HabitatKind) => void;
}

/** "Add" strip above the map: pick what to draw — habitats, utilities, walk routes, areas of interest… */
export function ShapePalette({ kinds, active, onPick }: Props) {
  return (
    <div className="shape-palette" role="toolbar" aria-label="Add to the map" data-tour="palette" onPointerDown={(e) => e.stopPropagation()}>
      <span className="shape-palette-label">Add</span>
      {kinds.map((k) => (
        <button
          key={k}
          type="button"
          className="palette-chip"
          aria-pressed={active === k}
          onClick={() => onPick(k)}
          title={KIND_META[k].hint}
          style={{ ['--c' as string]: KIND_META[k].color }}
        >
          <KindIcon kind={k} />
          <span>{KIND_META[k].label}</span>
        </button>
      ))}
    </div>
  );
}
