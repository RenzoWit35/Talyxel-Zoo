import type { NotificationType } from '../shared/types';
import { run, type DB } from './db';

interface NotifyInput {
  /** Who gets the notification. */
  userId: number;
  actorId: number;
  type: NotificationType;
  eventId?: number | null;
  commentId?: number | null;
  surveyId?: number | null;
  data?: Record<string, unknown>;
}

/** Tell someone about something another person did — never about their own actions. */
export function notify(db: DB, n: NotifyInput) {
  if (n.userId === n.actorId) return;
  run(
    db,
    'INSERT INTO notifications (user_id, actor_id, type, event_id, comment_id, survey_id, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
    n.userId,
    n.actorId,
    n.type,
    n.eventId ?? null,
    n.commentId ?? null,
    n.surveyId ?? null,
    JSON.stringify(n.data ?? {}),
  );
}

/** Take a notification back when the action is undone (unlike, unfollow). */
export function unnotify(db: DB, n: Pick<NotifyInput, 'userId' | 'actorId' | 'type' | 'eventId'>) {
  run(
    db,
    'DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type = ? AND (? IS NULL OR event_id = ?)',
    n.userId,
    n.actorId,
    n.type,
    n.eventId ?? null,
    n.eventId ?? null,
  );
}
