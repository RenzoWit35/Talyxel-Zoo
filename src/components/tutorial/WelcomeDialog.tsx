import { Heart, MessageCircle, TrendingUp, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { KIND_META, type HabitatKind } from '../../../shared/constants';
import { DEMO_SHAPES } from '../../lib/demo';
import { KindIcon } from '../KindIcon';
import { ZooThumbnail } from '../ZooThumbnail';

const PALETTE: HabitatKind[] = ['habitat', 'utility', 'route', 'interest', 'coaster'];

const SLIDES: { title: string; text: string; art: ReactNode }[] = [
  {
    title: 'Welcome to Talyxel Park',
    text: 'Plan your Planet Zoo and Planet Coaster parks from above, keep every screenshot and idea in one place, and share them with friends.',
    art: <ZooThumbnail width={300} height={200} shapes={DEMO_SHAPES} className="welcome-map" fit="meet" />,
  },
  {
    title: 'Draw your park',
    text: 'Pick what to add — a habitat or ride, a utility, a walk route or an area of interest — and click it out on the map. Everything saves as you go.',
    art: (
      <div className="welcome-chips">
        {PALETTE.map((k) => (
          <span key={k} className="palette-chip" style={{ ['--c' as string]: KIND_META[k].color }}>
            <KindIcon kind={k} />
            <span>{KIND_META[k].label}</span>
          </span>
        ))}
      </div>
    ),
  },
  {
    title: 'Share updates and ask questions',
    text: 'Post screenshots of what you built or ask your followers what to do next. They like your posts with a double-tap and answer in the comments.',
    art: (
      <div className="welcome-post">
        <div className="welcome-post-photo" />
        <div className="welcome-post-bar">
          <Heart className="liked" /> <MessageCircle /> <span>24 likes · 6 answers</span>
        </div>
      </div>
    ),
  },
  {
    title: 'Keep track of your stats',
    text: 'Copy guests, ratings and money from the game whenever you play. Your park page shows how the numbers changed since last time.',
    art: (
      <div className="welcome-stats">
        <div className="stat-tile headline">
          <span className="stat-label">Guests</span>
          <strong className="stat-value">1,250</strong>
          <span className="stat-change up">
            <TrendingUp /> +200
          </span>
        </div>
        <div className="stat-tile headline">
          <span className="stat-label">Zoo rating</span>
          <strong className="stat-value">4.5 ★</strong>
          <span className="stat-change up">
            <TrendingUp /> +0.5
          </span>
        </div>
      </div>
    ),
  },
];

/** A short introduction shown right after signing up (and from the guide). */
export function WelcomeDialog({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(SLIDES.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => nextRef.current?.focus(), [index]);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="welcome modal" role="dialog" aria-modal="true" aria-label={slide.title}>
        <button className="btn btn-ghost btn-icon btn-sm welcome-close" aria-label="Close" onClick={onClose}>
          <X />
        </button>
        <div className="welcome-art" aria-hidden="true">
          {slide.art}
        </div>
        <div className="welcome-body">
          <h2>{slide.title}</h2>
          <p>{slide.text}</p>
        </div>
        <div className="welcome-foot">
          <div className="welcome-dots" aria-label={`Step ${index + 1} of ${SLIDES.length}`}>
            {SLIDES.map((s, i) => (
              <button key={s.title} className={i === index ? 'on' : ''} aria-label={`Go to step ${i + 1}`} onClick={() => setIndex(i)} />
            ))}
          </div>
          <span className="spacer" />
          {index > 0 ? (
            <button className="btn btn-ghost" onClick={() => setIndex(index - 1)}>
              Back
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={onClose}>
              Skip
            </button>
          )}
          {last ? (
            <Link to="/zoos?new=1" className="btn btn-primary" onClick={onClose} ref={nextRef as never}>
              Plan my first park
            </Link>
          ) : (
            <button ref={nextRef} className="btn btn-primary" onClick={() => setIndex(index + 1)}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
