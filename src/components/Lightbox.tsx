import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Photo } from '../../shared/types';

interface Props {
  photos: Photo[];
  start?: number;
  title?: string;
  onClose: () => void;
}

export function Lightbox({ photos, start = 0, title, onClose }: Props) {
  const [index, setIndex] = useState(start);
  const count = photos.length;
  const photo = photos[Math.min(index, count - 1)];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % count);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + count) % count);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [count, onClose]);

  if (!photo) return null;
  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={title ?? 'Photo'} onClick={onClose}>
      <button className="lightbox-close" aria-label="Close" onClick={onClose}>
        <X />
      </button>
      {count > 1 && (
        <button
          className="lightbox-nav prev"
          aria-label="Previous photo"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i - 1 + count) % count);
          }}
        >
          <ChevronLeft />
        </button>
      )}
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={photo.url} alt={photo.caption || title || ''} />
        <figcaption>
          {title && <strong>{title}</strong>}
          {photo.caption && <span>{photo.caption}</span>}
          {count > 1 && (
            <span className="lightbox-count">
              {index + 1} / {count}
            </span>
          )}
        </figcaption>
      </figure>
      {count > 1 && (
        <button
          className="lightbox-nav next"
          aria-label="Next photo"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i + 1) % count);
          }}
        >
          <ChevronRight />
        </button>
      )}
    </div>,
    document.body,
  );
}

/** A grid of photo thumbnails that opens a lightbox on click. */
export function PhotoGrid({ photos, title, max = 6, className = 'photo-grid' }: { photos: Photo[]; title?: string; max?: number; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;
  const shown = photos.slice(0, max);
  const extra = photos.length - shown.length;
  return (
    <>
      <div className={className} data-count={Math.min(shown.length, 4)}>
        {shown.map((p, i) => (
          <button key={p.id} className="photo-tile" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1}`}>
            <img src={p.url} alt={p.caption} loading="lazy" />
            {i === shown.length - 1 && extra > 0 && <span className="photo-more">+{extra}</span>}
          </button>
        ))}
      </div>
      {open !== null && <Lightbox photos={photos} start={open} title={title} onClose={() => setOpen(null)} />}
    </>
  );
}
