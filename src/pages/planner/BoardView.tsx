import { Images, Lightbulb, Plus } from 'lucide-react';
import { useState, type DragEvent, type FormEvent } from 'react';
import { HABITAT_STATUSES, KIND_META, STATUS_META, type HabitatStatus } from '../../../shared/constants';
import { formatArea, polygonArea } from '../../../shared/geometry';
import type { Habitat } from '../../../shared/types';

type Columns = Record<HabitatStatus, number[]>;

interface Props {
  habitats: Habitat[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onSave: (columns: Columns) => void;
  onAddIdea: (name: string) => void;
}

const HINTS: Record<HabitatStatus, string> = {
  idea: 'Wishes and maybes',
  planned: 'Drawn and decided',
  building: 'Being built in-game',
  done: 'Finished and open',
};

/** Kanban view of the plan: drag cards between columns to change their status. */
export function BoardView({ habitats, selectedId, onSelect, onSave, onAddIdea }: Props) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [drop, setDrop] = useState<{ status: HabitatStatus; index: number } | null>(null);
  const [idea, setIdea] = useState('');

  const columns = Object.fromEntries(
    HABITAT_STATUSES.map((s) => [s, habitats.filter((h) => h.status === s).sort((a, b) => a.position - b.position || a.id - b.id)]),
  ) as Record<HabitatStatus, Habitat[]>;

  const dropIndex = (e: DragEvent<HTMLDivElement>, status: HabitatStatus) => {
    const cards = [...e.currentTarget.querySelectorAll<HTMLElement>('.board-card')];
    const index = cards.findIndex((c) => {
      const r = c.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    return { status, index: index === -1 ? cards.length : index };
  };

  const onDrop = (status: HabitatStatus) => {
    if (dragId === null || !drop) return;
    const next = Object.fromEntries(HABITAT_STATUSES.map((s) => [s, columns[s].map((h) => h.id)])) as Columns;
    const from = columns[status].findIndex((h) => h.id === dragId);
    let index = drop.index;
    if (from !== -1 && from < index) index--; // removing the card shifts later ones up
    for (const s of HABITAT_STATUSES) next[s] = next[s].filter((id) => id !== dragId);
    next[status].splice(index, 0, dragId);
    setDragId(null);
    setDrop(null);
    onSave(next);
  };

  const submitIdea = (e: FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) return;
    onAddIdea(idea.trim());
    setIdea('');
  };

  return (
    <div className="board">
      {HABITAT_STATUSES.map((status) => (
        <div
          key={status}
          className={`board-col${drop?.status === status ? ' drop' : ''}`}
          onDragOver={(e) => {
            if (dragId === null) return;
            e.preventDefault();
            setDrop(dropIndex(e, status));
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            onDrop(status);
          }}
        >
          <div className="board-col-head">
            <span className="swatch-dot" style={{ background: STATUS_META[status].color, borderRadius: 6 }} />
            <strong>{STATUS_META[status].label}</strong>
            <span className="count">{columns[status].length}</span>
          </div>
          <p className="board-col-hint">{HINTS[status]}</p>
          <div className="board-cards">
            {columns[status].map((h, i) => (
              <div key={h.id} className="board-slot">
                {drop?.status === status && drop.index === i && <div className="board-drop-marker" />}
                <button
                  className={`board-card${h.id === selectedId ? ' selected' : ''}${h.id === dragId ? ' dragging' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    setDragId(h.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(h.id));
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDrop(null);
                  }}
                  onClick={() => onSelect(h.id)}
                  style={{ ['--c' as string]: h.color }}
                >
                  {h.photos[0] && <img src={h.photos[0].url} alt="" loading="lazy" />}
                  <div className="board-card-body">
                    <strong>{h.name}</strong>
                    {h.species && <span className="species">{h.species}</span>}
                    <div className="row row-wrap" style={{ gap: 5 }}>
                      <span className="chip">{KIND_META[h.kind].label}</span>
                      <span className="subtle">{formatArea(polygonArea(h.points))}</span>
                      {h.photos.length > 0 && (
                        <span className="subtle row" style={{ gap: 3 }}>
                          <Images size={13} /> {h.photos.length}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            ))}
            {drop?.status === status && drop.index === columns[status].length && <div className="board-drop-marker" />}
            {columns[status].length === 0 && !drop && <div className="board-empty">Drag cards here</div>}
          </div>
          {status === 'idea' && (
            <form className="board-add" onSubmit={submitIdea}>
              <Lightbulb size={16} />
              <input className="input" placeholder="Quick idea, e.g. Penguin pool" value={idea} maxLength={60} onChange={(e) => setIdea(e.target.value)} />
              <button className="btn btn-sm btn-icon" aria-label="Add idea" disabled={!idea.trim()}>
                <Plus />
              </button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
