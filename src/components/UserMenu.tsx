import { BookOpen, LogOut, Map, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import type { Me } from '../../shared/types';
import { useAuthActions } from '../auth';
import { useTheme } from './ThemeToggle';
import { Avatar } from './ui';

/** The avatar in the top bar: profile, parks, guide, light/dark and log out. */
export function UserMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuthActions();
  const theme = useTheme();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={wrap}>
      <button className="user-menu-button" aria-label="Your account" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Avatar user={me} size={38} />
      </button>
      {open && (
        <div className="menu card user-menu-panel" role="menu">
          <div className="user-menu-head">
            <strong>{me.displayName}</strong>
            <span className="subtle">@{me.username}</span>
          </div>
          <Link role="menuitem" className="menu-item" to={`/u/${me.username}`}>
            <UserRound /> Your profile
          </Link>
          <Link role="menuitem" className="menu-item" to="/zoos">
            <Map /> Your parks
          </Link>
          <Link role="menuitem" className="menu-item" to="/guide">
            <BookOpen /> How it works
          </Link>
          <button role="menuitem" className="menu-item" onClick={theme.toggle} aria-label={theme.label}>
            <theme.Icon /> {theme.theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button role="menuitem" className="menu-item" onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/') })}>
            <LogOut /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
