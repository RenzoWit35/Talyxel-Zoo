import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router';
import type { UserSummary } from '../../shared/types';
import { initials } from '../lib/format';

export function LogoMark({ className = 'brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#2f6b47" />
      <path d="M14 40 L24 18 L40 14 L52 28 L46 48 L26 52 Z" fill="#9fcf8a" stroke="#f4f1e8" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="33" cy="33" r="5" fill="#f4f1e8" />
      <circle cx="25" cy="27" r="2.6" fill="#f4f1e8" />
      <circle cx="33" cy="23.5" r="2.6" fill="#f4f1e8" />
      <circle cx="41" cy="27" r="2.6" fill="#f4f1e8" />
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
