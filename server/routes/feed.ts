import { Router } from 'express';
import { z } from 'zod';
import { FEED_FILTERS, type FeedPage } from '../../shared/types';
import { all, type DB } from '../db';
import { buildFeedItems, EVENT_SELECT, VISIBLE, type EventRow } from '../feed-items';
import { parse, requireUser } from '../http';

const PAGE_SIZE = 20;

/** The viewer and the people they follow, for the audience clauses below. */
const PEOPLE = `WITH viewer(id) AS (SELECT ?),
  following(id) AS (SELECT followee_id FROM follows, viewer WHERE follower_id = viewer.id)`;

/** Whose events a filter shows: you and everyone you follow, friends (mutual follows), or only the people you follow. */
const AUDIENCE = {
  all: 'e.actor_id IN (SELECT id FROM viewer UNION SELECT id FROM following)',
  friends: `e.actor_id IN (SELECT f.id FROM following f
    JOIN follows back ON back.follower_id = f.id AND back.followee_id = (SELECT id FROM viewer))`,
  following: 'e.actor_id IN (SELECT id FROM following)',
  questions: 'e.actor_id IN (SELECT id FROM viewer UNION SELECT id FROM following)',
} satisfies Record<(typeof FEED_FILTERS)[number], string>;

const filterParam = z.enum(FEED_FILTERS).default('all');

export function feedRoutes(db: DB) {
  const r = Router();

  // Posts and park activity from you and the people you follow, newest first.
  // ?filter=friends|following|questions narrows it down.
  r.get('/', (req, res) => {
    const me = requireUser(req);
    const filter = parse(filterParam, req.query.filter);
    const before = Number(req.query.before);
    const cursor = Number.isInteger(before) && before > 0 ? before : null;
    const questionsOnly = filter === 'questions' ? `AND e.post_id IN (SELECT id FROM posts WHERE kind = 'question')` : '';
    const rows = all<EventRow>(
      db,
      `${PEOPLE}
       ${EVENT_SELECT}
       WHERE ${VISIBLE}
         AND ${AUDIENCE[filter]}
         ${questionsOnly}
         AND (? IS NULL OR e.id < ?)
       ORDER BY e.id DESC LIMIT ?`,
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
