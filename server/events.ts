import type { FeedEventType } from '../shared/types';
import { one, run, type DB } from './db';

interface EventInput {
  actorId: number;
  type: FeedEventType;
  zooId: number;
  habitatId?: number | null;
  surveyId?: number | null;
  data?: Record<string, unknown>;
}

function isPublished(db: DB, zooId: number) {
  return !!one(db, "SELECT 1 FROM zoos WHERE id = ? AND status = 'published'", zooId);
}

function insert(db: DB, e: EventInput) {
  run(
    db,
    'INSERT INTO events (actor_id, type, zoo_id, habitat_id, survey_id, data) VALUES (?, ?, ?, ?, ?, ?)',
    e.actorId,
    e.type,
    e.zooId,
    e.habitatId ?? null,
    e.surveyId ?? null,
    JSON.stringify(e.data ?? {}),
  );
}

/** Records a feed event, but only for published zoos — drafts stay private. */
export function recordEvent(db: DB, e: EventInput) {
  if (e.type !== 'zoo_published' && !isPublished(db, e.zooId)) return;
  insert(db, e);
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
  let ids = photoIds;
  if (previous && Date.now() - new Date(previous.created_at).getTime() < PHOTO_MERGE_WINDOW_MS) {
    const earlier = (JSON.parse(previous.data) as { photoIds?: number[] }).photoIds ?? [];
    ids = [...earlier, ...photoIds];
    run(db, 'DELETE FROM events WHERE id = ?', previous.id);
  }
  insert(db, { actorId, type: 'photos_added', zooId, habitatId, data: { photoIds: ids } });
}
