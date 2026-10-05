import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import type { NotificationItem, NotificationsPage } from '../../shared/types';
import { api } from '../api/client';
import { timeAgo } from '../lib/format';
import { Avatar } from './ui';

function describe(n: NotificationItem): ReactNode {
  const who = <strong>{n.actor.displayName}</strong>;
  const about = n.target ? <> “{n.target}”</> : null;
  switch (n.type) {
    case 'follow':
      return <>{who} started following you.</>;
    case 'like':
      return (
        <>
          {who} liked your post{about}.
        </>
      );
    case 'comment':
      return (
        <>
          {who} commented{n.target ? <> on “{n.target}”</> : null}: <span className="notif-quote">{n.comment}</span>
        </>
      );
    case 'suggestion':
      return (
        <>
          {who} suggested <span className="notif-quote">“{n.comment}”</span> in your survey{about}.
        </>
      );
  }
}

/** Bell with an unread count; opening it lists the latest notifications and marks them read. */
export function NotificationBell() {
  const qc = useQueryClient();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const query = useQuery({ queryKey: ['notifications'], queryFn: api.notifications, refetchInterval: 60_000, refetchOnWindowFocus: true });
  const markRead = useMutation({
    mutationFn: api.markNotificationsRead,
    // Items keep their "new" look while the panel is open; only the badge clears.
    onSuccess: () => qc.setQueryData<NotificationsPage>(['notifications'], (d) => (d ? { ...d, unread: 0 } : d)),
  });
  const unread = query.data?.unread ?? 0;

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

  const toggle = () => {
    if (open) {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      return;
    }
    setOpen(true);
    if (unread) markRead.mutate();
  };

  return (
    <div className="notif" ref={wrap}>
      <button
        className="btn btn-ghost btn-icon btn-sm notif-button"
        aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}
        aria-expanded={open}
        title="Notifications"
        onClick={toggle}
      >
        <Bell />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel card" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <h3>Notifications</h3>
          </div>
          {query.data?.items.length ? (
            <ul className="notif-list">
              {query.data.items.map((n) => (
                <li key={n.id}>
                  <Link to={n.link} className={`notif-item${n.read ? '' : ' unread'}`} onClick={() => setOpen(false)}>
                    <Avatar user={n.actor} size={36} />
                    <span className="notif-text">
                      {describe(n)} <span className="subtle">{timeAgo(n.createdAt)}</span>
                    </span>
                    {n.thumbnailUrl && <img className="notif-thumb" src={n.thumbnailUrl} alt="" loading="lazy" />}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="notif-empty">When people follow you, like or answer your posts or suggest something in your surveys, you'll see it here.</p>
          )}
        </div>
      )}
    </div>
  );
}
