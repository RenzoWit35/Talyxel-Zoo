import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router';
import type { UserSummary } from '../../shared/types';
import { initials } from '../lib/format';

/** Lucide "trees" at 21px, as used in the Figma logo tile. */
const TREES =
  'M6.12446 14V19.25M11.3745 16.625V19.25M10.4991 16.625H17.7616C17.9329 16.6226 18.0997 16.57 18.2413 16.4737C18.3829 16.3774 18.4932 16.2416 18.5584 16.0832C18.6236 15.9249 18.6409 15.7508 18.6082 15.5827C18.5754 15.4146 18.494 15.2598 18.3741 15.1375L15.7491 12.25H16.0116C16.1829 12.2476 16.3497 12.195 16.4913 12.0987C16.6329 12.0024 16.7432 11.8666 16.8084 11.7082C16.8736 11.5499 16.8909 11.3758 16.8582 11.2077C16.8254 11.0396 16.744 10.8848 16.6241 10.7625L13.9991 7.875H14.1741C14.3528 7.89112 14.5322 7.85191 14.6879 7.76267C14.8436 7.67343 14.968 7.53848 15.0444 7.37611C15.1209 7.21374 15.1455 7.03181 15.115 6.85497C15.0846 6.67813 15.0005 6.51493 14.8741 6.3875L11.3741 2.625L10.1491 3.9375M8.74911 8.75V8.925C9.32296 9.14568 9.80114 9.56078 10.1003 10.0979C10.3994 10.6351 10.5005 11.2602 10.3859 11.8642C10.2714 12.4683 9.94843 13.0129 9.4734 13.4032C8.99837 13.7936 8.40141 14.0048 7.78661 14H4.37411C3.76666 13.9849 3.18327 13.7595 2.72343 13.3623C2.2636 12.9651 1.95581 12.4206 1.85257 11.8218C1.74933 11.223 1.85703 10.6069 2.15729 10.0787C2.45756 9.5504 2.9318 9.14266 3.49911 8.925V8.75C3.49911 8.05381 3.77568 7.38613 4.26796 6.89384C4.76024 6.40156 5.42792 6.125 6.12411 6.125C6.82031 6.125 7.48799 6.40156 7.98027 6.89384C8.47255 7.38613 8.74911 8.05381 8.74911 8.75Z';

export function LogoMark({ className = 'brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 38 38" aria-hidden="true">
      <rect width="38" height="38" rx="10" fill="#17201b" />
      <path transform="translate(8.5 8.5)" d={TREES} fill="none" stroke="#3c674f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
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
