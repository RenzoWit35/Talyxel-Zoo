import { Compass, LogIn, LogOut, Map, Rss, Users } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuthActions, useMe } from '../auth';
import { NotificationBell } from './NotificationBell';
import { Avatar, LogoMark } from './ui';

export function Layout() {
  const { me } = useMe();
  const { logout } = useAuthActions();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const fullBleed = /^\/zoos\/\d+\/edit/.test(pathname);

  const links = [
    ...(me ? [{ to: '/', label: 'Feed', icon: <Rss />, end: true }] : []),
    { to: '/explore', label: 'Explore', icon: <Compass /> },
    ...(me ? [{ to: '/zoos', label: 'My parks', icon: <Map /> }] : []),
    { to: '/people', label: 'People', icon: <Users /> },
  ];

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link to="/" className="brand" aria-label="Talyxel Park home">
            <LogoMark />
            <span>
              Talyxel <em>Park</em>
            </span>
          </Link>
          <nav className="nav-links" aria-label="Main">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                {l.icon}
                {l.label}
              </NavLink>
            ))}
          </nav>
          <span className="spacer" />
          {me ? (
            <div className="nav-user">
              <NotificationBell />
              <Link to={`/u/${me.username}`} className="nav-user-link">
                <Avatar user={me} size={30} />
                <span>{me.displayName}</span>
              </Link>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                aria-label="Log out"
                title="Log out"
                onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/') })}
              >
                <LogOut />
              </button>
            </div>
          ) : (
            <div className="row">
              <Link to="/login" className="btn btn-ghost btn-sm">
                <LogIn /> Log in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </header>
      <main className={`app-main${fullBleed ? ' app-main-full' : ''}`}>
        <Outlet />
      </main>
      {!fullBleed && (
        <nav className="mobile-tabs" aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {l.icon}
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
    </>
  );
}
