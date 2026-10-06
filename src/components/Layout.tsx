import { BookOpen, Compass, House, LogIn, Map, MessagesSquare, Plus, Search, Users } from 'lucide-react';
import { Suspense, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useMe } from '../auth';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { LogoMark, PageLoader } from './ui';
import { UserMenu } from './UserMenu';
import { SiteFooter } from './decor';

/** "Search builders and parks" — opens Explore with the results. */
function HeaderSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/explore?q=${encodeURIComponent(q.trim())}`);
    setQ('');
  };
  return (
    <form className="header-search" role="search" onSubmit={submit}>
      <Search aria-hidden="true" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search builders and parks" aria-label="Search builders and parks" />
    </form>
  );
}

export function Layout() {
  const { me } = useMe();
  const { pathname } = useLocation();
  const fullBleed = /^\/zoos\/\d+\/edit/.test(pathname);

  const tabs = me
    ? [
        { to: '/', label: 'Home', icon: <House />, end: true },
        { to: '/social', label: 'Social', icon: <MessagesSquare /> },
        { to: '/zoos', label: 'Parks', icon: <Map /> },
        { to: '/explore', label: 'Explore', icon: <Compass /> },
      ]
    : [
        { to: '/explore', label: 'Explore', icon: <Compass /> },
        { to: '/people', label: 'Builders', icon: <Users /> },
        { to: '/guide', label: 'How it works', icon: <BookOpen /> },
      ];

  return (
    <>
      <header className="nav">
        <div className={`nav-inner${me ? '' : ' public'}`}>
          <Link to="/" className="brand" aria-label="Talyxel Park home">
            <LogoMark />
            <span className="brand-text">
              <span className="brand-name">Talyxel Park</span>
              <span className="brand-sub">{me ? 'Community studio' : 'Discover parks'}</span>
            </span>
          </Link>
          <nav className={me ? 'nav-tabs' : 'nav-links'} aria-label="Main">
            {tabs.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className="nav-actions">
            {me ? (
              <>
                <HeaderSearch />
                <NotificationBell />
                <UserMenu me={me} />
              </>
            ) : (
              <>
                <ThemeToggle />
                <Link to="/login" className="btn nav-login" aria-label="Log in">
                  <LogIn /> <span>Log in</span>
                </Link>
                <Link to="/register" className="btn btn-primary nav-signup">
                  <Plus /> <span>Start your park</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className={`app-main${fullBleed ? ' app-main-full' : ''}`}>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      {!fullBleed && <SiteFooter />}
      {!fullBleed && (
        <nav className="mobile-tabs" aria-label="Main">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {t.icon}
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}
    </>
  );
}
