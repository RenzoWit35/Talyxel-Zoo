import { Clock, Copy, Fence, Hexagon, Images, ImagePlus, Lightbulb, Link2, Loader2, Mountain, Ruler, Scan, Spline, Trash2, X } from 'lucide-react';
import { useState, type DragEvent, type ReactNode } from 'react';
import { BIOME_LABELS, HABITAT_COLORS, HABITAT_STATUSES, isLineKind, KIND_META, LIMITS, STATUS_META } from '../../../shared/constants';
import { parkMeta } from '../../../shared/parks';
import type { Habitat } from '../../../shared/types';
import { KindIcon } from '../../components/KindIcon';
import { Lightbox } from '../../components/Lightbox';
import { useToast } from '../../components/toast';
import { shapeFacts } from '../../lib/shapes';
import type { ZooEditor } from './useZooEditor';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

function PhotoManager({ habitat, editor }: { habitat: Habitat; editor: ZooEditor }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [link, setLink] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const room = LIMITS.photosPerHabitat - habitat.photos.length;

  const upload = async (list: FileList | File[]) => {
    const files = [...list].filter((f) => ACCEPT.includes(f.type));
    if (!files.length) return toast.error(new Error('Choose PNG, JPEG, WebP or GIF images'));
    if (files.some((f) => f.size > LIMITS.uploadBytes)) return toast.error(new Error('Images can be at most 8 MB each'));
    setBusy(true);
    try {
      for (let i = 0; i < files.length; i += 12) await editor.uploadPhotos(habitat.id, files.slice(i, i + 12));
      toast.ok(files.length === 1 ? 'Photo added' : `${files.length} photos added`);
    } catch {
      /* toast already shown */
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
  };

  const addLink = async () => {
    if (!link.trim()) return;
    setBusy(true);
    try {
      await editor.addPhotoUrl(habitat.id, link.trim());
      setLink('');
    } catch {
      /* toast already shown */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-section">
      <div className="panel-section-head">
        <h4>Photos</h4>
        <span className="subtle">
          {habitat.photos.length}/{LIMITS.photosPerHabitat}
        </span>
      </div>
      {habitat.photos.length > 0 && (
        <div className="photo-manager">
          {habitat.photos.map((p, i) => (
            <div key={p.id} className="photo-item">
              <button className="photo-item-thumb" onClick={() => setOpen(i)} aria-label="View photo">
                <img src={p.url} alt={p.caption} loading="lazy" />
              </button>
              <input
                className="input"
                defaultValue={p.caption}
                placeholder="Caption"
                maxLength={200}
                onBlur={(e) => e.target.value !== p.caption && void editor.updatePhotoCaption(p.id, e.target.value).catch(() => {})}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
              <button className="btn btn-ghost btn-icon btn-sm" aria-label="Delete photo" onClick={() => void editor.deletePhoto(p.id).catch(() => {})}>
                <X />
              </button>
            </div>
          ))}
        </div>
      )}
      {room > 0 && (
        <>
          <label
            className={`dropzone${over ? ' over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            {busy ? <Loader2 className="spin" /> : <ImagePlus />}
            <span>
              <strong>{busy ? 'Uploading…' : 'Add screenshots'}</strong>
              <br />
              <span className="subtle">Drop images here or click to browse</span>
            </span>
            <input
              type="file"
              accept={ACCEPT}
              multiple
              hidden
              disabled={busy}
              onChange={(e) => {
                if (e.target.files) void upload(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
          <div className="row">
            <label className="input-with-icon spacer">
              <Link2 />
              <input
                className="input"
                placeholder="…or paste an https:// image link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addLink()}
              />
            </label>
            <button className="btn btn-sm" onClick={addLink} disabled={busy || !link.trim()}>
              Add
            </button>
          </div>
        </>
      )}
      {open !== null && <Lightbox photos={habitat.photos} start={open} title={habitat.name} onClose={() => setOpen(null)} />}
    </div>
  );
}

interface Props {
  habitat: Habitat;
  editor: ZooEditor;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function HabitatPanel({ habitat, editor, onClose, onDelete, onDuplicate }: Props) {
  const set = (patch: Parameters<ZooEditor['updateHabitat']>[1]) => editor.updateHabitat(habitat.id, patch);
  const meta = parkMeta(editor.zoo.parkType);
  const kindMeta = KIND_META[habitat.kind];
  const isFeature = meta.featureKinds.includes(habitat.kind);
  const isLine = isLineKind(habitat.kind);
  // Walk routes, utilities and areas of interest have their own lists; main attractions use the park's species or ride types.
  const subjectLabel = kindMeta.subjectLabel ?? (isFeature ? meta.subjectLabel : 'Subtitle');
  const subjects = kindMeta.subjects ?? (isFeature ? meta.subjects : []);
  const subjectPlaceholder = kindMeta.subjects ? `e.g. ${kindMeta.subjects[0]}` : isFeature ? meta.subjectPlaceholder : 'Optional — shown under the name';
  // A line can only switch to another line type, an area to another area type.
  const kinds = meta.kinds.filter((k) => isLineKind(k) === isLine);
  const coaster = editor.zoo.parkType === 'theme_park';
  const [open, setOpen] = useState<number | null>(null);
  const [size, edge] = shapeFacts(habitat);
  const facts: { icon: ReactNode; label: string; value: string }[] = [
    { icon: isLine ? <Ruler /> : <Scan />, ...size },
    { icon: isLine ? <Clock /> : <Fence />, ...edge },
    { icon: isLine ? <Spline /> : <Hexagon />, label: isLine ? 'Points' : 'Corners', value: String(habitat.points.length) },
    { icon: <Mountain />, label: meta.settingLabel, value: habitat.biome ? BIOME_LABELS[habitat.biome] : '—' },
  ];
  return (
    <div className={`panel-inner shape-panel${coaster ? ' is-coaster' : ''}`}>
      <div className="shape-panel-head">
        <h2 className="sr-only">{kindMeta.label} details</h2>
        <div className="row">
          <span className={`chip ${coaster ? 'chip-pink' : 'chip-mint'}`}>Selected {kindMeta.label.toLowerCase()}</span>
          <span className="spacer" />
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close details" title="Close (Esc)">
            <X />
          </button>
        </div>
        <input className="shape-title" aria-label="Name" value={habitat.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
      </div>

      <div className="panel-section">
        {habitat.photos.length > 0 && (
          <button className="shape-cover" onClick={() => setOpen(0)} aria-label={`View photos of ${habitat.name}`}>
            <img src={habitat.photos[0].url} alt={habitat.photos[0].caption} />
            <span className="shape-cover-count">
              <Images /> {habitat.photos.length === 1 ? '1 photo' : `${habitat.photos.length} photos`}
            </span>
          </button>
        )}
        <label className="shape-subject">
          <span className="shape-subject-icon">
            <KindIcon kind={habitat.kind} />
          </span>
          <span className="spacer">
            <small>{subjectLabel}</small>
            <input list="subject-list" value={habitat.species} maxLength={80} placeholder={subjectPlaceholder} onChange={(e) => set({ species: e.target.value })} />
          </span>
          <datalist id="subject-list">
            {subjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <div className="shape-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <span className="shape-fact-icon">{fact.icon}</span>
              <span>
                <small>{fact.label}</small>
                <strong>{fact.value}</strong>
              </span>
            </div>
          ))}
        </div>
        <label className="field">
          <span>Description</span>
          <textarea
            className="textarea"
            value={habitat.description}
            maxLength={2000}
            placeholder={meta.notesPlaceholder}
            onChange={(e) => set({ description: e.target.value })}
          />
        </label>
        <label className="shape-reason">
          <span>
            <Lightbulb /> Why it’s built this way
          </span>
          <textarea
            value={habitat.reason}
            maxLength={1000}
            rows={3}
            placeholder={isLine ? 'e.g. The route bends here so guests see the lions before the overlook.' : 'e.g. A low wall on this side keeps the view open from the main path.'}
            onChange={(e) => set({ reason: e.target.value })}
          />
        </label>
        <div className="field">
          <span>Status</span>
          <div className="segmented full">
            {HABITAT_STATUSES.map((s) => (
              <button key={s} aria-pressed={habitat.status === s} onClick={() => set({ status: s })}>
                <span className="swatch-dot" style={{ background: STATUS_META[s].color, width: 8, height: 8, borderRadius: 4 }} />
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <label className="field spacer">
            <span>Type</span>
            <select className="select" value={habitat.kind} onChange={(e) => set({ kind: e.target.value as Habitat['kind'] })}>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_META[k].label}
                </option>
              ))}
            </select>
          </label>
          <label className="field spacer">
            <span>{meta.settingLabel}</span>
            <select className="select" value={habitat.biome} onChange={(e) => set({ biome: e.target.value as Habitat['biome'] })}>
              {meta.settings.map((b) => (
                <option key={b} value={b}>
                  {b ? BIOME_LABELS[b] : '—'}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="field">
          <span>Colour</span>
          <div className="swatches">
            {HABITAT_COLORS.map((c) => (
              <button key={c} className="swatch" style={{ background: c }} aria-label={c} aria-pressed={habitat.color === c} onClick={() => set({ color: c })} />
            ))}
            <label className="swatch swatch-custom" title="Custom colour">
              <input type="color" value={habitat.color} onChange={(e) => set({ color: e.target.value })} />
            </label>
          </div>
        </div>
        <p className="subtle">
          {isLine
            ? 'Drag the route to move it, drag the white dots to bend it, click a small dot to add a point and right-click a point to remove it. Arrows show the walking direction.'
            : 'Drag the shape to move it, drag the white dots to reshape, click a small dot to add a corner and right-click a corner to remove it.'}
        </p>
      </div>

      <PhotoManager habitat={habitat} editor={editor} />
      {open !== null && <Lightbox photos={habitat.photos} start={open} title={habitat.name} onClose={() => setOpen(null)} />}

      <div className="panel-section panel-actions">
        <button className="btn btn-block" onClick={onDuplicate} title="Duplicate (Ctrl+D)">
          <Copy /> Duplicate
        </button>
        <button className="btn btn-danger btn-block" onClick={onDelete}>
          <Trash2 /> Delete {KIND_META[habitat.kind].label.toLowerCase()}
        </button>
      </div>
    </div>
  );
}
