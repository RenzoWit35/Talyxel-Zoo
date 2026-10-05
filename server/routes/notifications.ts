import { Router } from 'express';
import type { FeedItem, NotificationItem, NotificationsPage, NotificationSubject, NotificationType } from '../../shared/types';
import { all, one, placeholders, run, type DB } from '../db';
import { buildFeedItems, EVENT_SELECT, type EventRow } from '../feed-items';
import { requireUser } from '../http';
import { toUserSummary } from '../queries';

interface NotificationRow {
  id: number;
  type: NotificationType;
  event_id: number | null;
  comment_id: number | null;
  survey_id: number | null;
  data: string;
  created_at: string;
  read_at: string | null;
  actor_id: number;
  username: string;
  display_name: string;
  avatar_color: string;
  comment_body: string | null;
  survey_question: string | null;
  survey_zoo_id: number | null;
}

/** Notifications about park activity or surveys only count while the park is published. */
const FROM = `
  FROM notifications n
  JOIN users u ON u.id = n.actor_id
  LEFT JOIN events e ON e.id = n.event_id
  LEFT JOIN zoos ez ON ez.id = e.zoo_id
  LEFT JOIN surveys s ON s.id = n.survey_id
  LEFT JOIN zoos sz ON sz.id = s.zoo_id
  LEFT JOIN comments c ON c.id = n.comment_id
  WHERE n.user_id = ?
    AND (n.event_id IS NULL OR e.zoo_id IS NULL OR ez.status = 'published')
    AND (n.survey_id IS NULL OR sz.status = 'published')`;

const SUBJECT: Record<FeedItem['type'], NotificationSubject> = {
  post_created: 'post',
  zoo_published: 'park',
  habitat_added: 'shape',
  photos_added: 'photos',
  survey_created: 'survey',
};

const excerpt = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

export function notificationRoutes(db: DB) {
  const r = Router();

  const unreadCount = (userId: number) => one<{ n: number }>(db, `SELECT COUNT(*) AS n ${FROM} AND n.read_at IS NULL`, userId)!.n;

  r.get('/', (req, res) => {
    const me = requireUser(req);
    const rows = all<NotificationRow>(
      db,
      `SELECT n.*, u.username, u.display_name, u.avatar_color, c.body AS comment_body,
         s.question AS survey_question, s.zoo_id AS survey_zoo_id
       ${FROM} ORDER BY n.id DESC LIMIT 40`,
      me.id,
    );
    // What the likes and comments are on, rendered the same way as in the feed.
    const eventIds = [...new Set(rows.flatMap((n) => (n.event_id ? [n.event_id] : [])))];
    const events = eventIds.length ? all<EventRow>(db, `${EVENT_SELECT} WHERE e.id IN (${placeholders(eventIds.length)})`, ...eventIds) : [];
    const itemById = new Map(buildFeedItems(db, events, me.id).map((i) => [i.id, i]));

    const items: NotificationItem[] = rows.map((n) => {
      const actor = toUserSummary({ id: n.actor_id, username: n.username, display_name: n.display_name, avatar_color: n.avatar_color });
      const item = n.event_id ? itemById.get(n.event_id) : undefined;
      const label = item?.post?.body || item?.habitat?.name || item?.zoo?.title || null;
      const about: NotificationSubject | null = item ? (item.post?.kind === 'question' ? 'question' : SUBJECT[item.type]) : n.type === 'suggestion' ? 'survey' : null;
      const base = { id: n.id, type: n.type, about, createdAt: n.created_at, read: !!n.read_at, actor };
      switch (n.type) {
        case 'follow':
          return { ...base, link: `/u/${actor.username}`, target: null, comment: null, thumbnailUrl: null };
        case 'suggestion':
          return {
            ...base,
            link: `/z/${n.survey_zoo_id}#surveys`,
            target: n.survey_question,
            comment: (JSON.parse(n.data) as { label?: string }).label ?? null,
            thumbnailUrl: null,
          };
        default:
          return {
            ...base,
            link: `/p/${n.event_id}`,
            target: label ? excerpt(label, 60) : null,
            comment: n.comment_body ? excerpt(n.comment_body, 120) : null,
            thumbnailUrl: item?.post?.photos[0]?.url ?? item?.photos[0]?.url ?? null,
          };
      }
    });
    const body: NotificationsPage = { items, unread: unreadCount(me.id) };
    res.json(body);
  });

  r.post('/read', (req, res) => {
    const me = requireUser(req);
    run(db, "UPDATE notifications SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND read_at IS NULL", me.id);
    res.json({ unread: unreadCount(me.id) });
  });

  return r;
}
