import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router';
import type { NotificationsPage } from '../../shared/types';
import { api } from '../api/client';
import { describeNotification } from '../components/NotificationBell';
import { Avatar, EmptyState, PageLoader } from '../components/ui';
import { timeAgo } from '../lib/format';

/** Every recent notification on one page (the bell shows the same list in a popover). */
export function ActivityPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['notifications'], queryFn: api.notifications });
  const markRead = useMutation({
    mutationFn: api.markNotificationsRead,
    onSuccess: () => qc.setQueryData<NotificationsPage>(['notifications'], (d) => (d ? { ...d, unread: 0 } : d)),
  });
  const unread = query.data?.unread ?? 0;
  useEffect(() => {
    if (unread) markRead.mutate();
    // only when the count first arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread > 0]);

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <span className="lp-pill">Your notifications</span>
          <h1>Activity</h1>
          <p>Followers, likes, answers and survey suggestions — newest first.</p>
        </div>
      </div>
      {query.isPending ? (
        <PageLoader />
      ) : query.data?.items.length ? (
        <ul className="card activity-page-list">
          {query.data.items.map((n) => (
            <li key={n.id}>
              <Link to={n.link} className={`notif-item${n.read ? '' : ' unread'}`}>
                <Avatar user={n.actor} size={40} />
                <span className="notif-text">
                  {describeNotification(n)} <span className="subtle">{timeAgo(n.createdAt)}</span>
                </span>
                {n.thumbnailUrl && <img className="notif-thumb" src={n.thumbnailUrl} alt="" loading="lazy" />}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card">
          <EmptyState icon={<Bell />} title="Nothing yet">
            When people follow you, like or answer your posts or suggest something in your surveys, you'll see it here.
          </EmptyState>
        </div>
      )}
    </div>
  );
}
