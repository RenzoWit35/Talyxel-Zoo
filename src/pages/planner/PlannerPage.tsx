import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChartColumn,
  Check,
  CloudOff,
  ExternalLink,
  Globe,
  Hand,
  Hexagon,
  Layers,
  LayoutGrid,
  Loader2,
  Lock,
  Magnet,
  Map as MapIcon,
  MousePointer2,
  PanelRight,
  Spline,
  Square,
  Trash2,
  Undo2,
  Vote,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { isLineKind, KIND_META, type HabitatKind } from '../../../shared/constants';
import { bounds, type Point } from '../../../shared/geometry';
import { parkMeta } from '../../../shared/parks';
import type { Habitat, ZooDetail } from '../../../shared/types';
import { api, ApiError, errorMessage } from '../../api/client';
import { LayerToggles } from '../../components/map/LayerToggles';
import { MapCanvas, type Tool } from '../../components/map/MapCanvas';
import { StatsForm } from '../../components/stats/StatsForm';
import { NewSurveyDialog } from '../../components/SurveyEditor';
import { useToast } from '../../components/toast';
import { Modal, PageLoader } from '../../components/ui';
import { plural } from '../../lib/format';
import { NotFound } from '../NotFound';
import { BoardView } from './BoardView';
import { HabitatPanel } from './HabitatPanel';
import { PublishDialog } from './PublishDialog';
import { ShapePalette } from './ShapePalette';
import { useZooEditor, type SaveState } from './useZooEditor';
import { ZooPanel } from './ZooPanel';

const TOOLS: { id: Tool; label: string; key: string; icon: React.ReactNode }[] = [
  { id: 'select', label: 'Select & move', key: 'V', icon: <MousePointer2 /> },
  { id: 'polygon', label: 'Draw freeform shape', key: 'P', icon: <Hexagon /> },
  { id: 'rect', label: 'Draw rectangle', key: 'R', icon: <Square /> },
  { id: 'line', label: 'Draw walk route (line)', key: 'L', icon: <Spline /> },
  { id: 'pan', label: 'Pan', key: 'H', icon: <Hand /> },
];

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving')
    return (
      <span className="save-state">
        <Loader2 className="spin" /> Saving…
      </span>
    );
  if (state === 'error')
    return (
      <span className="save-state error">
        <CloudOff /> Not saved
      </span>
    );
  return (
    <span className="save-state">
      <Check /> Saved
    </span>
  );
}

/** Find an empty spot for a new placeholder square, scanning the map in rows. */
function freeSpot(zoo: ZooDetail): Point[] {
  const size = Math.max(4, Math.round(Math.min(zoo.width, zoo.height) * 0.08));
  const boxes = zoo.habitats.map((h) => bounds(h.points));
  const gap = size / 2;
  for (let y = gap; y + size <= zoo.height; y += size + gap) {
    for (let x = gap; x + size <= zoo.width; x += size + gap) {
      const hit = boxes.some((b) => x < b.maxX && x + size > b.minX && y < b.maxY && y + size > b.minY);
      if (!hit) return [[x, y], [x + size, y], [x + size, y + size], [x, y + size]];
    }
  }
  const x = (zoo.width - size) / 2;
  const y = (zoo.height - size) / 2;
  return [[x, y], [x + size, y], [x + size, y + size], [x, y + size]];
}

function Planner({ initial }: { initial: ZooDetail }) {
  const editor = useZooEditor(initial);
  const { zoo } = editor;
  const meta = parkMeta(zoo.parkType);
  const navigate = useNavigate();
  const toast = useToast();
  const [view, setView] = useState<'map' | 'board'>('map');
  const [tool, setTool] = useState<Tool>('select');
  const [drawKind, setDrawKind] = useState<HabitatKind>(meta.defaultKind);
  const [snap, setSnap] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draftPoints, setDraftPoints] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<Habitat | null>(null);
  const [confirmDeleteZoo, setConfirmDeleteZoo] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [newSurvey, setNewSurvey] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hiddenKinds, setHiddenKinds] = useState<Set<HabitatKind>>(() => new Set());
  const [layersOpen, setLayersOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const selected = zoo.habitats.find((h) => h.id === selectedId) ?? null;
  // If the park type changes, fall back to its main shape type for drawing.
  const kindToDraw = meta.kinds.includes(drawKind) ? drawKind : meta.defaultKind;

  /** Tools and shape types go together: the line tool draws walk routes, the area tools draw everything else. */
  const pickTool = useCallback(
    (next: Tool) => {
      setTool(next);
      if (next === 'line' && !isLineKind(kindToDraw)) setDrawKind('route');
      if ((next === 'polygon' || next === 'rect') && isLineKind(kindToDraw)) setDrawKind(meta.defaultKind);
    },
    [kindToDraw, meta.defaultKind],
  );

  const pickKind = (kind: HabitatKind) => {
    setDrawKind(kind);
    setTool(isLineKind(kind) ? 'line' : tool === 'rect' ? 'rect' : 'polygon');
    if (hiddenKinds.has(kind)) {
      const next = new Set(hiddenKinds);
      next.delete(kind);
      setHiddenKinds(next);
    }
  };

  // A shape that gets hidden can't stay selected.
  useEffect(() => {
    if (selected && hiddenKinds.has(selected.kind)) setSelectedId(null);
  }, [hiddenKinds, selected]);

  const select = useCallback((id: number | null) => {
    setSelectedId(id);
    if (id !== null) setPanelOpen(true);
  }, []);

  const requestDelete = useCallback((id: number) => setConfirmDelete(zoo.habitats.find((h) => h.id === id) ?? null), [zoo.habitats]);

  const onChangePoints = useCallback((id: number, points: Point[]) => editor.updateHabitat(id, { points }, { immediate: true }), [editor]);

  const onCreateShape = useCallback(
    async (points: Point[]) => {
      try {
        const h = await editor.createHabitat(points, kindToDraw);
        setTool('select');
        select(h.id);
      } catch {
        /* toast already shown */
      }
    },
    [editor, kindToDraw, select],
  );

  // Global shortcuts (the canvas handles drawing-specific keys itself).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const id = editor.undo();
        if (id !== null) select(id);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || view !== 'map') return;
      const key = e.key.toLowerCase();
      const found = TOOLS.find((x) => x.key.toLowerCase() === key);
      if (found) pickTool(found.id);
      if (key === 's') setSnap((s) => !s);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor, view, select, pickTool]);

  const addIdea = async (name: string) => {
    try {
      const h = await editor.createHabitat(freeSpot(zoo), meta.defaultKind, { name, status: 'idea' });
      select(h.id);
      toast.ok('Idea added — switch to the map to place it');
    } catch {
      /* toast already shown */
    }
  };

  const deleteZoo = async () => {
    try {
      await api.deleteZoo(zoo.id);
      toast.ok(`${meta.label} deleted`);
      navigate('/zoos');
    } catch (err) {
      toast.error(err);
    }
  };

  const drawing = view === 'map' && (tool === 'polygon' || tool === 'rect' || tool === 'line');
  const ideas = zoo.habitats.filter((h) => h.status === 'idea').map((h) => h.name);

  return (
    <div className="planner">
      <header className="planner-bar">
        <Link to="/zoos" className="btn btn-ghost btn-icon btn-sm" aria-label="Back to my parks" title="My parks">
          <ArrowLeft />
        </Link>
        <input
          className="planner-title"
          value={zoo.title}
          maxLength={80}
          aria-label="Park name"
          onChange={(e) => editor.updateZoo({ title: e.target.value })}
          onBlur={(e) => !e.target.value.trim() && editor.updateZoo({ title: initial.title })}
        />
        {zoo.status === 'published' ? (
          <span className="chip chip-brand">
            <Globe /> Published
          </span>
        ) : (
          <span className="chip">
            <Lock /> Draft
          </span>
        )}
        <SaveIndicator state={editor.saveState} />
        <span className="spacer" />
        <div className="segmented planner-views" role="tablist" aria-label="View">
          <button aria-pressed={view === 'map'} onClick={() => setView('map')}>
            <MapIcon /> <span>Map</span>
          </button>
          <button aria-pressed={view === 'board'} onClick={() => setView('board')}>
            <LayoutGrid /> <span>Board</span>
          </button>
        </div>
        <button className="btn btn-sm planner-stats-btn" onClick={() => setStatsOpen(true)} title="Park statistics">
          <ChartColumn /> <span>Stats</span>
        </button>
        {zoo.status === 'published' ? (
          <div className="row planner-actions">
            <button className="btn btn-sm" onClick={() => setNewSurvey(true)}>
              <Vote /> <span>New survey</span>
            </button>
            <Link to={`/z/${zoo.id}`} className="btn btn-sm">
              <ExternalLink /> <span>View page</span>
            </Link>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() =>
                editor.unpublish().then(
                  () => toast.ok('Back to draft — only you can see it now'),
                  () => {},
                )
              }
            >
              Unpublish
            </button>
          </div>
        ) : (
          <button className="btn btn-sm btn-accent" onClick={() => setPublishing(true)}>
            <Globe /> <span>Publish</span>
          </button>
        )}
        <button className="btn btn-sm btn-icon planner-panel-toggle" aria-label="Show details panel" onClick={() => setPanelOpen((o) => !o)}>
          <PanelRight />
        </button>
      </header>

      <div className={`planner-body view-${view}`}>
        {view === 'map' && (
          <div className="planner-tools" role="toolbar" aria-label="Drawing tools">
            {TOOLS.map((t) => (
              <button key={t.id} className="tool" aria-pressed={tool === t.id} onClick={() => pickTool(t.id)} title={`${t.label} (${t.key})`} aria-label={t.label}>
                {t.icon}
              </button>
            ))}
            <span className="tool-sep" />
            <button className="tool" aria-pressed={snap} onClick={() => setSnap((s) => !s)} title="Snap to grid & corners (S)" aria-label="Snapping">
              <Magnet />
            </button>
            <button
              className={'tool' + (hiddenKinds.size ? ' tool-flag' : '')}
              aria-pressed={layersOpen}
              aria-expanded={layersOpen}
              onClick={() => setLayersOpen((o) => !o)}
              title="Layers: show or hide shape types"
              aria-label="Layers"
            >
              <Layers />
            </button>
            <button className="tool" onClick={() => {
                const id = editor.undo();
                if (id !== null) select(id);
              }} disabled={!editor.canUndo} title="Undo shape edit (Ctrl+Z)" aria-label="Undo">
              <Undo2 />
            </button>
            <button className="tool tool-danger" disabled={!selected} onClick={() => selected && setConfirmDelete(selected)} title="Delete selected (Del)" aria-label="Delete selected">
              <Trash2 />
            </button>
          </div>
        )}

        <div className="planner-stage">
          {view === 'map' ? (
            <>
              <MapCanvas
                width={zoo.width}
                height={zoo.height}
                habitats={zoo.habitats}
                background={zoo.backgroundUrl ? { url: zoo.backgroundUrl, opacity: zoo.backgroundOpacity } : null}
                editable
                tool={tool}
                snap={snap}
                selectedId={selectedId}
                hiddenKinds={hiddenKinds}
                onSelect={select}
                onChangePoints={onChangePoints}
                onCreateShape={onCreateShape}
                onDeleteRequest={requestDelete}
                onDraftChange={setDraftPoints}
                hoverHint="Click to edit"
              />
              <ShapePalette kinds={meta.kinds} active={drawing ? kindToDraw : null} onPick={pickKind} />
              {drawing && (
                <div className="draw-hint" onPointerDown={(e) => e.stopPropagation()}>
                  <span className="swatch-dot" style={{ background: KIND_META[kindToDraw].color }} />
                  <span>
                    <strong>{KIND_META[kindToDraw].label}:</strong>{' '}
                    {tool === 'line'
                      ? draftPoints === 0
                        ? 'Click where the route starts.'
                        : draftPoints < 2
                          ? 'Click to add the next point.'
                          : 'Keep clicking to add points — double-click, click the last point again or press Enter to finish.'
                      : tool === 'rect'
                        ? 'Drag to draw a rectangle.'
                        : draftPoints === 0
                          ? 'Click to place the first corner.'
                          : draftPoints < 3
                            ? 'Keep clicking to add corners.'
                            : 'Click the first corner, double-click or press Enter to finish.'}{' '}
                    <span className="subtle">Esc cancels · Alt disables snapping</span>
                  </span>
                  <button className="btn btn-sm draw-hint-done" onClick={() => setTool('select')}>
                    Done
                  </button>
                </div>
              )}
              {layersOpen && (
                <div className="layers-menu card" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="row">
                    <strong className="spacer">Layers</strong>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setLayersOpen(false)} aria-label="Close layers">
                      <X />
                    </button>
                  </div>
                  <LayerToggles kinds={meta.kinds} habitats={zoo.habitats} hidden={hiddenKinds} onChange={setHiddenKinds} />
                </div>
              )}
              {zoo.habitats.length === 0 && !drawing && (
                <div className="stage-empty">
                  <strong>Your map is empty</strong>
                  <span>
                    Pick what to add from the bar above — a {KIND_META[meta.defaultKind].label.toLowerCase()}, a utility, a walk route or an area of interest — or
                    start with a drawing tool.
                  </span>
                  <div className="row">
                    <button className="btn btn-primary btn-sm" onClick={() => pickTool('polygon')}>
                      <Hexagon /> Freeform
                    </button>
                    <button className="btn btn-sm" onClick={() => pickTool('rect')}>
                      <Square /> Rectangle
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <BoardView
              habitats={zoo.habitats}
              selectedId={selectedId}
              onSelect={select}
              onSave={(columns) => void editor.saveBoard(columns).catch(() => {})}
              onAddIdea={addIdea}
              ideaExample={meta.ideaExample}
            />
          )}
        </div>

        <aside className={`planner-panel${panelOpen ? ' open' : ''}`}>
          {selected ? (
            <HabitatPanel
              key={selected.id}
              habitat={selected}
              editor={editor}
              onClose={() => {
                select(null);
                setPanelOpen(false);
              }}
              onDelete={() => setConfirmDelete(selected)}
            />
          ) : (
            <ZooPanel editor={editor} onDeleteZoo={() => setConfirmDeleteZoo(true)} onEditStats={() => setStatsOpen(true)} />
          )}
        </aside>
      </div>

      {confirmDelete && (
        <Modal
          title={`Delete “${confirmDelete.name}”?`}
          description={confirmDelete.photos.length ? `Its ${plural(confirmDelete.photos.length, 'photo')} will be deleted too.` : 'This cannot be undone.'}
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmDelete(null)}>
                Keep it
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  const id = confirmDelete.id;
                  setConfirmDelete(null);
                  if (selectedId === id) setSelectedId(null);
                  void editor.deleteHabitat(id).catch(() => {});
                }}
              >
                <Trash2 /> Delete
              </button>
            </>
          }
        >
          <p className="muted">The shape disappears from the map and the board.</p>
        </Modal>
      )}
      {confirmDeleteZoo && (
        <Modal
          title={`Delete “${zoo.title}”?`}
          description={`Every shape, photo and survey in this ${meta.noun} will be removed for good.`}
          onClose={() => setConfirmDeleteZoo(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmDeleteZoo(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={deleteZoo}>
                <Trash2 /> Delete {meta.noun}
              </button>
            </>
          }
        >
          <p className="muted">This cannot be undone.</p>
        </Modal>
      )}
      {publishing && <PublishDialog editor={editor} onClose={() => setPublishing(false)} />}
      {statsOpen && (
        <StatsForm zooId={zoo.id} parkType={zoo.parkType} stats={zoo.stats} onClose={() => setStatsOpen(false)} onSaved={editor.setStats} />
      )}
      {newSurvey && (
        <NewSurveyDialog zooId={zoo.id} title={zoo.title} ideas={ideas} examples={meta.optionExamples} onClose={() => setNewSurvey(false)} />
      )}
    </div>
  );
}

export function PlannerPage() {
  const { id } = useParams();
  const zooId = Number(id);
  const query = useQuery({ queryKey: ['zoo', zooId], queryFn: () => api.zoo(zooId), enabled: Number.isInteger(zooId), staleTime: 0 });

  if (!Number.isInteger(zooId)) return <NotFound what="park" />;
  if (query.isPending) return <PageLoader />;
  if (query.error) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotFound what="park" />;
    return <div className="page">{errorMessage(query.error)}</div>;
  }
  if (!query.data.isOwner) return <Navigate to={`/z/${zooId}`} replace />;
  return <Planner key={zooId} initial={query.data} />;
}
