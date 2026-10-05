import { ChartColumn, ImagePlus, Loader2, PenLine, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { HABITAT_STATUSES, KIND_META, LIMITS, PARK_TYPES, STATUS_META } from '../../../shared/constants';
import { formatArea, formatLength, polygonArea, polylineLength } from '../../../shared/geometry';
import { parkMeta } from '../../../shared/parks';
import { ParkIcon } from '../../components/ParkType';
import { StatsSummary } from '../../components/stats/StatsView';
import { capitalize, plural } from '../../lib/format';
import type { ZooEditor } from './useZooEditor';

const SHORTCUTS: [string, string][] = [
  ['V', 'Select & move'],
  ['P', 'Draw a freeform shape'],
  ['R', 'Draw a rectangle'],
  ['L', 'Draw a walk route'],
  ['H / Space', 'Pan the map'],
  ['Enter', 'Finish the shape'],
  ['Esc', 'Cancel / deselect'],
  ['Del', 'Delete selection'],
  ['Arrows', 'Nudge (Shift = more)'],
  ['Alt', 'Hold to draw without snapping'],
  ['S', 'Toggle snapping'],
  ['Ctrl Z', 'Undo shape edits'],
];

export function ZooPanel({ editor, onDeleteZoo, onEditStats }: { editor: ZooEditor; onDeleteZoo: () => void; onEditStats: () => void }) {
  const { zoo } = editor;
  const meta = parkMeta(zoo.parkType);
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
  const featureArea = habitats.filter((x) => meta.featureKinds.includes(x.kind)).reduce((sum, x) => sum + polygonArea(x.points), 0);
  const species = [...new Set(habitats.filter((x) => meta.featureKinds.includes(x.kind)).map((x) => x.species.trim()).filter(Boolean))];
  const byStatus = HABITAT_STATUSES.map((s) => ({ s, n: habitats.filter((x) => x.status === s).length }));
  const done = byStatus.find((b) => b.s === 'done')!.n;
  const routeLength = habitats.filter((x) => x.kind === 'route').reduce((sum, x) => sum + polylineLength(x.points), 0);
  const utilities = habitats.filter((x) => x.kind === 'utility').length;
  const interests = habitats.filter((x) => x.kind === 'interest').length;

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
            <small>{meta.featureStatLabel}</small>
            <strong>{formatArea(featureArea)}</strong>
          </div>
          <div>
            <small>{capitalize(meta.subjectNoun[1])}</small>
            <strong>{species.length}</strong>
          </div>
        </div>
        {(routeLength > 0 || utilities > 0 || interests > 0) && (
          <div className="stat-row">
            <div>
              <small>Routes</small>
              <strong>{formatLength(routeLength)}</strong>
            </div>
            <div>
              <small>Utilities</small>
              <strong>{utilities}</strong>
            </div>
            <div>
              <small>Of interest</small>
              <strong>{interests}</strong>
            </div>
          </div>
        )}
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
            <strong>Start drawing.</strong> Pick the <b>freeform</b> or <b>rectangle</b> tool on the left and outline your first {KIND_META[meta.defaultKind].label.toLowerCase()}. Shapes snap
            to the grid and to each other’s corners so neighbours line up.
          </div>
        )}
      </div>

      <div className="panel-section">
        <div className="panel-section-head">
          <h4>Park statistics</h4>
          {zoo.stats && (
            <button className="btn btn-ghost btn-sm" onClick={onEditStats}>
              <PenLine /> Update
            </button>
          )}
        </div>
        {zoo.stats ? (
          <StatsSummary stats={zoo.stats} parkType={zoo.parkType} />
        ) : (
          <>
            <p className="subtle">Copy guests, ratings and money from {meta.game} to show how your {meta.noun} is doing.</p>
            <button className="btn btn-sm" onClick={onEditStats}>
              <ChartColumn /> Add stats
            </button>
          </>
        )}
      </div>

      <div className="panel-section">
        <label className="field">
          <span>Description</span>
          <textarea
            className="textarea"
            value={zoo.description}
            maxLength={2000}
            placeholder={`What's the idea behind this ${meta.noun}?`}
            onChange={(e) => editor.updateZoo({ description: e.target.value })}
          />
        </label>
      </div>

      <div className="panel-section">
        <div className="panel-section-head">
          <h4>Map</h4>
        </div>
        <div className="field">
          <span>Plan type</span>
          <div className="segmented full" role="radiogroup" aria-label="Plan type">
            {PARK_TYPES.map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={zoo.parkType === t}
                aria-pressed={zoo.parkType === t}
                disabled={busy}
                onClick={() => t !== zoo.parkType && run(() => editor.setParkType(t))}
              >
                <ParkIcon type={t} size={15} /> {parkMeta(t).label}
              </button>
            ))}
          </div>
          <small>For {meta.game}. Switching keeps shared shapes like paths and water.</small>
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
          {meta.kinds.map((kind) => KIND_META[kind]).map((k) => (
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
          <Trash2 /> Delete this {meta.noun}
        </button>
      </div>
    </div>
  );
}
