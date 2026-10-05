import type { FeedEventType } from '../shared/types';
import { one, run, type DB } from './db';

interface EventInput {
  actorId: number;
  type: FeedEventType;
  zooId: number | null;
  habitatId?: number | null;
  surveyId?: number | null;
  postId?: number | null;
  data?: Record<string, unknown>;
}

function isPublished(db: DB, zooId: number) {
  return !!one(db, "SELECT 1 FROM zoos WHERE id = ? AND status = 'published'", zooId);
}

function insert(db: DB, e: EventInput) {
  return run(
    db,
    'INSERT INTO events (actor_id, type, zoo_id, habitat_id, survey_id, post_id, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
    e.actorId,
    e.type,
    e.zooId,
    e.habitatId ?? null,
    e.surveyId ?? null,
    e.postId ?? null,
    JSON.stringify(e.data ?? {}),
  ).id;
}

/** Records a feed event, but only for published zoos — drafts stay private. */
export function recordEvent(db: DB, e: EventInput & { zooId: number }) {
  if (e.type !== 'zoo_published' && !isPublished(db, e.zooId)) return;
  insert(db, e);
}

/** A builder's own post shows up in the feed as an event of its own. */
export function recordPost(db: DB, actorId: number, postId: number) {
  return insert(db, { actorId, type: 'post_created', zooId: null, postId });
}

const PHOTO_MERGE_WINDOW_MS = 60 * 60 * 1000;

/**
 * Photo uploads tend to come in bursts; fold uploads to the same habitat within an
 * hour into one feed entry (re-inserted so it moves to the top of the feed).
 */
export function recordPhotosAdded(db: DB, actorId: number, zooId: number, habitatId: number, photoIds: number[]) {
  if (!photoIds.length || !isPublished(db, zooId)) return;
  const previous = one<{ id: number; data: string; created_at: string }>(
    db,
    `SELECT id, data, created_at FROM events
     WHERE type = 'photos_added' AND actor_id = ? AND habitat_id = ? ORDER BY id DESC LIMIT 1`,
    actorId,
    habitatId,
  );
  const merge = previous && Date.now() - new Date(previous.created_at).getTime() < PHOTO_MERGE_WINDOW_MS;
  const earlier = merge ? ((JSON.parse(previous.data) as { photoIds?: number[] }).photoIds ?? []) : [];
  const id = insert(db, { actorId, type: 'photos_added', zooId, habitatId, data: { photoIds: [...earlier, ...photoIds] } });
  if (merge) {
    // The entry moves to the top of the feed under a new id; its likes and comments come along.
    for (const table of ['likes', 'comments', 'notifications']) run(db, `UPDATE ${table} SET event_id = ? WHERE event_id = ?`, id, previous.id);
    run(db, 'DELETE FROM events WHERE id = ?', previous.id);
  }
}
