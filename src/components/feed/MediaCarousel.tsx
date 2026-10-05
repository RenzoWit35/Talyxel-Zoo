import { ChevronLeft, ChevronRight, Heart, Maximize2 } from 'lucide-react';
import { useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router';
import type { HabitatKind } from '../../../shared/constants';
import type { Point } from '../../../shared/geometry';
import type { Photo, PostKind, ZooSummary } from '../../../shared/types';
import { Lightbox } from '../Lightbox';
import { ParkIcon } from '../ParkType';
import { ZooThumbnail } from '../ZooThumbnail';

export type Slide =
  | { type: 'photo'; photo: Photo }
  | { type: 'map'; zoo: ZooSummary; highlight?: { points: Point[]; kind: HabitatKind } }
  | { type: 'text'; text: string; tone: PostKind };

interface Props {
  slides: Slide[];
  /** Double-click or double-tap likes the post (it never un-likes, like on Instagram). */
  onDoubleTap: () => void;
  label: string;
}

const textSize = (text: string) => (text.length < 60 ? 'lg' : text.length < 130 ? 'md' : 'sm');

function SlideView({ slide, onExpand }: { slide: Slide; onExpand: () => void }) {
  switch (slide.type) {
    case 'photo':
      return (
        <>
          <img src={slide.photo.url} alt={slide.photo.caption} loading="lazy" draggable={false} />
          <button className="media-expand" aria-label="View full photo" onClick={onExpand} onDoubleClick={(e) => e.stopPropagation()}>
            <Maximize2 />
          </button>
        </>
      );
    case 'map':
      return (
        <>
          <ZooThumbnail width={slide.zoo.width} height={slide.zoo.height} shapes={slide.zoo.shapes} highlight={slide.highlight} className="media-map" fit="meet" />
          <Link to={`/z/${slide.zoo.id}`} className="media-map-tag" onDoubleClick={(e) => e.stopPropagation()}>
            <ParkIcon type={slide.zoo.parkType} size={14} />
            <span>{slide.zoo.title}</span>
          </Link>
        </>
      );
    case 'text':
      return (
        <div className={`media-text tone-${slide.tone} size-${textSize(slide.text)}`}>
          {slide.tone === 'question' && (
            <span className="media-text-mark" aria-hidden="true">
              ?
            </span>
          )}
          <p>{slide.text}</p>
        </div>
      );
  }
}

/** Square, swipeable media for a feed card: photos, the park's top-down map or a text card. */
export function MediaCarousel({ slides, onDoubleTap, label }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const lastTap = useRef(0);
  const [index, setIndex] = useState(0);
  const [burst, setBurst] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const photos = slides.flatMap((s) => (s.type === 'photo' ? [s.photo] : []));
  const count = slides.length;

  const like = () => {
    onDoubleTap();
    setBurst((b) => b + 1);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return; // mice get a real dblclick
    const now = Date.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      like();
    } else lastTap.current = now;
  };
  const go = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="media" role="region" aria-roledescription="carousel" aria-label={label}>
      <div
        className="media-track"
        ref={track}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        onDoubleClick={like}
        onPointerUp={onPointerUp}
      >
        {slides.map((slide, i) => (
          <div key={i} className={`media-slide slide-${slide.type}`} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>
            <SlideView slide={slide} onExpand={() => setLightbox(slide.type === 'photo' ? photos.indexOf(slide.photo) : 0)} />
          </div>
        ))}
      </div>
      {burst > 0 && <Heart key={burst} className="media-heart" aria-hidden="true" />}
      {count > 1 && (
        <>
          <span className="media-count">
            {index + 1}/{count}
          </span>
          {index > 0 && (
            <button className="media-nav prev" aria-label="Previous" onClick={() => go(index - 1)}>
              <ChevronLeft />
            </button>
          )}
          {index < count - 1 && (
            <button className="media-nav next" aria-label="Next" onClick={() => go(index + 1)}>
              <ChevronRight />
            </button>
          )}
          <div className="media-dots" aria-hidden="true">
            {slides.map((_, i) => (
              <span key={i} className={i === index ? 'on' : ''} />
            ))}
          </div>
        </>
      )}
      {lightbox !== null && <Lightbox photos={photos} start={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
