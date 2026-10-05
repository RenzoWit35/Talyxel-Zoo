import { X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface TourStep {
  /** CSS selector of the element to point at; the first visible match wins. Missing → a centred card. */
  target: string;
  title: string;
  body: ReactNode;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;
const GAP = 12;
const MARGIN = 12;

/** The first match that is actually on screen (a slid-away bottom sheet doesn't count). */
function findTarget(selector: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect();
    const onScreen = r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
    if (r.width > 0 && r.height > 0 && onScreen) return el;
  }
  return null;
}

/** Step-by-step coach marks: dims the page, outlines one element and explains it in a card next to it. */
export function CoachTour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  // The spotlight only glides between steps, not into its first spot.
  const [placed, setPlaced] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  const measure = useCallback(() => {
    const el = findTarget(step.target);
    const card = cardRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!el) {
      setBox(null);
      setCardPos(card ? { top: Math.max(MARGIN, (vh - card.offsetHeight) / 2), left: Math.max(MARGIN, (vw - card.offsetWidth) / 2) } : null);
      return;
    }
    const r = el.getBoundingClientRect();
    const b = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
    setBox(b);
    if (!card) return;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const clampX = (x: number) => Math.min(vw - cw - MARGIN, Math.max(MARGIN, x));
    const clampY = (y: number) => Math.min(vh - ch - MARGIN, Math.max(MARGIN, y));
    // Below, above, right, left — whichever fits first; otherwise over the element's middle.
    if (b.top + b.height + GAP + ch <= vh - MARGIN) setCardPos({ top: b.top + b.height + GAP, left: clampX(b.left) });
    else if (b.top - GAP - ch >= MARGIN) setCardPos({ top: b.top - GAP - ch, left: clampX(b.left) });
    else if (b.left + b.width + GAP + cw <= vw - MARGIN) setCardPos({ top: clampY(b.top), left: b.left + b.width + GAP });
    else if (b.left - GAP - cw >= MARGIN) setCardPos({ top: clampY(b.top), left: b.left - GAP - cw });
    else setCardPos({ top: clampY(b.top + b.height / 2 - ch / 2), left: clampX(b.left + b.width / 2 - cw / 2) });
  }, [step.target]);

  useLayoutEffect(() => {
    const el = findTarget(step.target);
    el?.scrollIntoView({ block: 'nearest' });
    measure();
    // The page can still be settling (fonts, panels, the map sizing itself): measure again when it does.
    let second = 0;
    const first = requestAnimationFrame(() => {
      measure();
      second = requestAnimationFrame(() => {
        measure();
        setPlaced(true);
      });
    });
    const ro = new ResizeObserver(() => measure());
    if (el) ro.observe(el);
    ro.observe(document.body);
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      ro.disconnect();
    };
  }, [measure, step.target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && !last) setIndex((i) => i + 1);
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    const onMove = () => requestAnimationFrame(measure);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [measure, onClose, last]);

  useEffect(() => nextRef.current?.focus(), [index]);

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-shield" onMouseDown={(e) => e.preventDefault()} />
      {box ? (
        <div className={`tour-spot${placed ? ' glide' : ''}`} style={{ top: box.top, left: box.left, width: box.width, height: box.height }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div ref={cardRef} className="tour-card card" style={cardPos ? { top: cardPos.top, left: cardPos.left } : { visibility: 'hidden' }}>
        <div className="tour-card-head">
          <span className="tour-count">
            {index + 1} of {steps.length}
          </span>
          <button className="btn btn-ghost btn-icon btn-sm" aria-label="End the tour" onClick={onClose}>
            <X />
          </button>
        </div>
        <h3 id="tour-title">{step.title}</h3>
        <div className="tour-body">{step.body}</div>
        <div className="tour-actions">
          {index > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={() => setIndex(index - 1)}>
              Back
            </button>
          )}
          <span className="spacer" />
          <button ref={nextRef} className="btn btn-sm btn-primary" onClick={() => (last ? onClose() : setIndex(index + 1))}>
            {last ? 'Start building' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
