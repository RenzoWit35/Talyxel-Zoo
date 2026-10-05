import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { HABITAT_STATUSES, KIND_META, LIMITS, STATUS_META } from '../../../shared/constants';
import { formatArea, polygonArea } from '../../../shared/geometry';
import { plural } from '../../lib/format';
import type { ZooEditor } from './useZooEditor';

const SHORTCUTS: [string, string][] = [
  ['V', 'Select & move'],
  ['P', 'Draw a freeform shape'],
  ['R', 'Draw a rectangle'],
  ['H / Space', 'Pan the map'],
  ['Enter', 'Finish the shape'],
  ['Esc', 'Cancel / deselect'],
  ['Del', 'Delete selection'],
  ['Arrows', 'Nudge (Shift = more)'],
  ['Alt', 'Hold to draw without snapping'],
  ['S', 'Toggle snapping'],
  ['Ctrl Z', 'Undo shape edits'],
];

export function ZooPanel({ editor, onDeleteZoo }: { editor: ZooEditor; onDeleteZoo: () => void }) {
  const { zoo } = editor;
  const [w, setW] = useState(String(zoo.width));
  const [h, setH] = useState(String(zoo.height));
  const [busy, setBusy] = useState(false);
  const [imageRatio, setImageRatio] = useState<number | null>(null);
  useEffect(() => {
    setW(String(zoo.width));
    setH(String(zoo.height));
  }, [zoo.width, zoo.height]);

  useEffect(() => {
    setImageRatio(null);
    if (!zoo.backgroundUrl) return;
    const img = new Image();
    img.onload = () => setImageRatio(img.naturalHeight / img.naturalWidth);
    img.src = zoo.backgroundUrl;
  }, [zoo.backgroundUrl]);

  const habitats = zoo.habitats;
  const animals = habitats.filter((x) => x.kind === 'habitat' || x.kind === 'exhibit');
  const animalArea = animals.reduce((sum, x) => sum + polygonArea(x.points), 0);
  const species = [...new Set(habitats.map((x) => x.species.trim()).filter(Boolean))];
  const byStatus = HABITAT_STATUSES.map((s) => ({ s, n: habitats.filter((x) => x.status === s).length }));
  const done = byStatus.find((b) => b.s === 'done')!.n;

  const wNum = Number(w);
  const hNum = Number(h);
  const sizeValid = wNum >= LIMITS.mapMin && wNum <= LIMITS.mapMax && hNum >= LIMITS.mapMin && hNum <= LIMITS.mapMax;
  const sizeChanged = wNum !== zoo.width || hNum !== zoo.height;
  const matchedHeight = imageRatio ? Math.round(zoo.width * imageRatio) : null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      /* toast already shown */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-inner">
      <div className="panel-head">
        <h3 className="spacer">Plan overview</h3>
      </div>

      <div className="panel-section">
        <div className="stat-row">
          <div>
            <small>Shapes</small>
            <strong>{habitats.length}</strong>
          </div>
          <div>
            <small>Animals</small>
            <strong>{formatArea(animalArea)}</strong>
          </div>
          <div>
            <small>Species</small>
            <strong>{species.length}</strong>
          </div>
        </div>
        {habitats.length > 0 && (
          <div className="progress-block">
            <div className="row">
              <span className="label spacer">Progress</span>
              <span className="subtle">
                {done} of {plural(habitats.length, 'shape')} done
              </span>
            </div>
            <div className="progress">
              {byStatus.map(({ s, n }) =>
                n ? <span key={s} style={{ flex: n, background: STATUS_META[s].color }} title={`${STATUS_META[s].label}: ${n}`} /> : null,
              )}
            </div>
            <div className="legend">
              {byStatus.map(({ s, n }) => (
                <span key={s}>
                  <i className={`legend-swatch status-${s}`} style={{ ['--c' as string]: STATUS_META[s].color }} />
                  {STATUS_META[s].label} <b>{n}</b>
                </span>
              ))}
            </div>
          </div>
        )}
        {species.length > 0 && (
          <div className="row row-wrap" style={{ gap: 5 }}>
            {species.map((s) => (
              <span key={s} className="chip chip-outline">
                {s}
              </span>
            ))}
          </div>
        )}
        {habitats.length === 0 && (
          <div className="tip">
            <strong>Start drawing.</strong> Pick the <b>freeform</b> or <b>rectangle</b> tool on the left and outline your first habitat. Shapes snap
            to the grid and to each other’s corners so neighbours line up.
          </div>
        )}
      </div>

      <div className="panel-section">
        <label className="field">
          <span>Description</span>
          <textarea
            className="textarea"
            value={zoo.description}
            maxLength={2000}
            placeholder="What's the idea behind this zoo?"
            onChange={(e) => editor.updateZoo({ description: e.target.value })}
          />
        </label>
      </div>

      <div className="panel-section">
        <div className="panel-section-head">
          <h4>Map</h4>
        </div>
        <div className="field">
          <span>Size in metres</span>
          <div className="row">
            <input className="input" type="number" value={w} min={LIMITS.mapMin} max={LIMITS.mapMax} onChange={(e) => setW(e.target.value)} aria-label="Width" />
            <span className="muted">×</span>
            <input className="input" type="number" value={h} min={LIMITS.mapMin} max={LIMITS.mapMax} onChange={(e) => setH(e.target.value)} aria-label="Height" />
            <button className="btn btn-sm" disabled={!sizeValid || !sizeChanged || busy} onClick={() => run(() => editor.resize(wNum, hNum))}>
              Apply
            </button>
          </div>
        </div>
        <div className="field">
          <span>Background image</span>
          {zoo.backgroundUrl ? (
            <>
              <div className="bg-preview">
                <img src={zoo.backgroundUrl} alt="Map background" />
              </div>
              <label className="field">
                <small>Opacity {Math.round(zoo.backgroundOpacity * 100)}%</small>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={zoo.backgroundOpacity}
                  onChange={(e) => editor.updateZoo({ backgroundOpacity: Number(e.target.value) })}
                />
              </label>
              <div className="row row-wrap">
                {matchedHeight && matchedHeight !== zoo.height && matchedHeight >= LIMITS.mapMin && matchedHeight <= LIMITS.mapMax && (
                  <button className="btn btn-sm" disabled={busy} onClick={() => run(() => editor.resize(zoo.width, matchedHeight))}>
                    Match image shape ({zoo.width} × {matchedHeight})
                  </button>
                )}
                <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => run(editor.removeBackground)}>
                  Remove
                </button>
              </div>
            </>
          ) : (
            <label className="dropzone compact">
              {busy ? <Loader2 className="spin" /> : <ImagePlus />}
              <span>
                <strong>Trace over a screenshot</strong>
                <br />
                <span className="subtle">Upload a top-down shot of your park; it's stretched to the map.</span>
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void run(() => editor.setBackground(file));
                }}
              />
            </label>
          )}
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-section-head">
          <h4>Shape types</h4>
        </div>
        <div className="legend legend-kinds">
          {Object.values(KIND_META).map((k) => (
            <span key={k.label} title={k.hint}>
              <i className="legend-swatch" style={{ ['--c' as string]: k.color }} />
              {k.label}
            </span>
          ))}
        </div>
      </div>

      <details className="panel-section shortcuts">
        <summary>Keyboard shortcuts</summary>
        <dl>
          {SHORTCUTS.map(([k, d]) => (
            <div key={k}>
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
      </details>

      <div className="panel-section">
        <button className="btn btn-danger btn-block" onClick={onDeleteZoo}>
          <Trash2 /> Delete this zoo
        </button>
      </div>
    </div>
  );
}
