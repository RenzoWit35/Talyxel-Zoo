import { Heart, MapPin } from 'lucide-react';
import { useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router';
import type { HabitatKind } from '../../../shared/constants';
import type { Point } from '../../../shared/geometry';
import type { Photo, ZooSummary } from '../../../shared/types';
import { parkProgress } from '../../lib/parks';
import { Lightbox } from '../Lightbox';
import { ZooThumbnail } from '../ZooThumbnail';

interface Props {
  photos: Photo[];
  /** Shown when there are no photos: the park's top-down map, optionally with one shape highlighted. */
  zoo: ZooSummary | null;
  highlight?: { points: Point[]; kind: HabitatKind };
  /** Where it is, e.g. "Elephants · Savanna Park"; links to the park. */
  place?: string;
  placeTo?: string;
  /** Double-click or double-tap likes the post (it never un-likes, like on Instagram). */
  onDoubleTap: () => void;
  label: string;
}

/** Photos the grid shows before folding the rest into "+n". */
const GRID_MAX = 3;

/** A post's pictures in one rounded frame: one photo, a grid of a few, or the park map. */
export function PostMedia({ photos, zoo, highlight, place, placeTo, onDoubleTap, label }: Props) {
  const lastTap = useRef(0);
  const lastLike = useRef(0);
  const openTimer = useRef<number | undefined>(undefined);
  const [burst, setBurst] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  if (!photos.length && !zoo) return null;

  const like = () => {
    window.clearTimeout(openTimer.current);
    lastLike.current = Date.now();
    onDoubleTap();
    setBurst((b) => b + 1);
  };
  const open = (i: number, clicks: number) => {
    if (clicks > 1 || Date.now() - lastLike.current < 400) return;
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => setLightbox(i), 260);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return; // mice get a real dblclick
    const now = Date.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      like();
    } else lastTap.current = now;
  };

  const shown = photos.slice(0, GRID_MAX);
  const hidden = photos.length - shown.length;
  const layout = photos.length === 0 ? 'map' : `n${Math.min(photos.length, GRID_MAX)}`;
  const progress = zoo && zoo.habitatCount > 0 ? parkProgress(zoo) : null;

  return (
    <div className={`post-media is-${layout}`} role="group" aria-label={label} onDoubleClick={like} onPointerUp={onPointerUp}>
      {shown.length ? (
        shown.map((photo, i) => (
          <button key={photo.id} className="post-media-photo" aria-label={`View photo ${i + 1} of ${photos.length}`} onClick={(e) => open(i, e.detail)}>
            <img src={photo.url} alt={photo.caption} loading="lazy" draggable={false} />
            {i === shown.length - 1 && hidden > 0 && <span className="post-media-more">+{hidden}</span>}
          </button>
        ))
      ) : (
        <ZooThumbnail width={zoo!.width} height={zoo!.height} shapes={zoo!.shapes} highlight={highlight} className="post-media-map" fit="meet" />
      )}
      {place && placeTo && (
        <Link to={placeTo} className="post-place-pill" onDoubleClick={(e) => e.stopPropagation()}>
          <MapPin aria-hidden="true" />
          <span>{place}</span>
        </Link>
      )}
      {progress !== null && <span className={`post-progress${zoo!.parkType === 'theme_park' ? ' is-coaster' : ''}`}>{progress}% built</span>}
      {burst > 0 && <Heart key={burst} className="media-heart" aria-hidden="true" />}
      {lightbox !== null && <Lightbox photos={photos} start={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
