import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router';
import type { UserSummary } from '../../shared/types';
import { initials } from '../lib/format';

/** Talyxel Park's mark: a lime coaster track on supports over an olive hill, with a sage tree, on navy. */
export function LogoMark({ className = 'brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 38 38" aria-hidden="true">
      <rect width="38" height="38" rx="7" fill="#0a2239" />
      <path d="M0 29 Q 19 23.5 38 29 V31 a7 7 0 0 1 -7 7 H7 a7 7 0 0 1 -7 -7 Z" fill="#60712f" />
      <path d="M10.5 17.5 V27 M17 20 V26.2 M26 13.5 V25.6" stroke="#a8ccc9" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5 25.5 C 8 12, 12.5 11, 16 19.5 C 18.5 25, 21.5 13, 26 12.5 C 29 12.2, 31 15, 33 17" fill="none" stroke="#dceab2" strokeWidth="2.7" strokeLinecap="round" />
      <circle cx="30.2" cy="24.2" r="3.4" fill="#a8ccc9" />
      <path d="M30.2 27 V29.6" stroke="#0a2239" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function Avatar({ user, size = 36 }: { user: Pick<UserSummary, 'displayName' | 'avatarColor'>; size?: number }) {
  return (
    <span className="avatar" style={{ background: user.avatarColor, ['--size' as string]: `${size}px` }} aria-hidden="true">
      {initials(user.displayName)}
    </span>
  );
}

export function UserLink({ user, children }: { user: UserSummary; children?: ReactNode }) {
  return (
    <Link to={`/u/${user.username}`} className="user-link">
      {children ?? user.displayName}
    </Link>
  );
}

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div className="center-pad">
      <Spinner />
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

interface ModalProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ title, description, onClose, children, footer, wide }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button:not(.modal-close)')?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <div className="spacer">
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="btn btn-ghost btn-icon btn-sm modal-close" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
