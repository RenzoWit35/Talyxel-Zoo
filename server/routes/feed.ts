import { Router } from 'express';
import type { FeedPage } from '../../shared/types';
import { all, type DB } from '../db';
import { buildFeedItems, EVENT_SELECT, VISIBLE, type EventRow } from '../feed-items';
import { requireUser } from '../http';

const PAGE_SIZE = 20;

export function feedRoutes(db: DB) {
  const r = Router();

  // Posts and park activity from you and the people you follow, newest first.
  r.get('/', (req, res) => {
    const me = requireUser(req);
    const before = Number(req.query.before);
    const cursor = Number.isInteger(before) && before > 0 ? before : null;
    const rows = all<EventRow>(
      db,
      `${EVENT_SELECT}
       WHERE ${VISIBLE}
         AND (e.actor_id = ? OR e.actor_id IN (SELECT followee_id FROM follows WHERE follower_id = ?))
         AND (? IS NULL OR e.id < ?)
       ORDER BY e.id DESC LIMIT ?`,
      me.id,
      me.id,
      cursor,
      cursor,
      PAGE_SIZE + 1,
    );
    const page = rows.slice(0, PAGE_SIZE);
    const nextCursor = rows.length > PAGE_SIZE ? page[page.length - 1].id : null;
    const body: FeedPage = { items: buildFeedItems(db, page, me.id), nextCursor };
    res.json(body);
  });

  return r;
}
