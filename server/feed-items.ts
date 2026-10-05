import type { Point } from '../shared/geometry';
import type { Comment, FeedEventType, FeedItem, FeedPost, Photo, PostKind, UserSummary } from '../shared/types';
import { all, one, placeholders, type DB } from './db';
import { loadPhotos, loadZooSummaries, toUserSummary, ZOO_SELECT, type HabitatRow, type ZooRow } from './queries';

export interface EventRow {
  id: number;
  actor_id: number;
  type: FeedEventType;
  zoo_id: number | null;
  habitat_id: number | null;
  survey_id: number | null;
  post_id: number | null;
  data: string;
  created_at: string;
  username: string;
  display_name: string;
  avatar_color: string;
}

/** Events with their actor. Join-filter with VISIBLE so drafts never leak. */
export const EVENT_SELECT = `
  SELECT e.*, u.username, u.display_name, u.avatar_color
  FROM events e
  JOIN users u ON u.id = e.actor_id
  LEFT JOIN zoos z ON z.id = e.zoo_id`;

/** Posts have no park of their own; park activity only counts while the park is published. */
export const VISIBLE = `(e.zoo_id IS NULL OR z.status = 'published')`;

export function getVisibleEvent(db: DB, id: number): EventRow | undefined {
  return one<EventRow>(db, `${EVENT_SELECT} WHERE e.id = ? AND ${VISIBLE}`, id);
}

interface PostRow {
  id: number;
  user_id: number;
  kind: PostKind;
  body: string;
  zoo_id: number | null;
  created_at: string;
}

interface CommentRow {
  id: number;
  event_id: number;
  user_id: number;
  body: string;
  created_at: string;
  username: string;
  display_name: string;
  avatar_color: string;
}

const COMMENT_SELECT = `
  SELECT c.*, u.username, u.display_name, u.avatar_color
  FROM comments c JOIN users u ON u.id = c.user_id`;

export function toComment(row: CommentRow, viewerId: number | undefined, itemOwnerId: number): Comment {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    author: toUserSummary({ id: row.user_id, username: row.username, display_name: row.display_name, avatar_color: row.avatar_color }),
    canDelete: viewerId !== undefined && (viewerId === row.user_id || viewerId === itemOwnerId),
  };
}

export function loadComment(db: DB, id: number) {
  return one<CommentRow>(db, `${COMMENT_SELECT} WHERE c.id = ?`, id);
}

/** Every comment on one item, oldest first. */
export function loadAllComments(db: DB, event: Pick<EventRow, 'id' | 'actor_id'>, viewerId: number | undefined): Comment[] {
  return all<CommentRow>(db, `${COMMENT_SELECT} WHERE c.event_id = ? ORDER BY c.id`, event.id).map((c) => toComment(c, viewerId, event.actor_id));
}

export function likeState(db: DB, eventId: number, viewerId: number) {
  const { n } = one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM likes WHERE event_id = ?', eventId)!;
  const liked = !!one(db, 'SELECT 1 FROM likes WHERE event_id = ? AND user_id = ?', eventId, viewerId);
  return { likes: n, liked };
}

/**
 * Turns event rows into feed cards: park summaries (published only), shapes, photos, surveys,
 * posts with their photos, like counts and the latest comments — all loaded in a few batched queries.
 */
export function buildFeedItems(db: DB, rows: EventRow[], viewerId: number | undefined, opts: { allComments?: boolean } = {}): FeedItem[] {
  if (!rows.length) return [];
  const eventIds = rows.map((e) => e.id);

  const postIds = [...new Set(rows.flatMap((e) => (e.post_id ? [e.post_id] : [])))];
  const posts = postIds.length ? all<PostRow>(db, `SELECT * FROM posts WHERE id IN (${placeholders(postIds.length)})`, ...postIds) : [];
  const postById = new Map(posts.map((p) => [p.id, p]));
  const postPhotos = postIds.length
    ? all<{ id: number; post_id: number; url: string }>(
        db,
        `SELECT id, post_id, url FROM post_photos WHERE post_id IN (${placeholders(postIds.length)}) ORDER BY position, id`,
        ...postIds,
      )
    : [];

  // Parks: the event's own park, or the park a post links to — shown only while published.
  const zooIds = [...new Set(rows.flatMap((e) => [e.zoo_id, e.post_id ? postById.get(e.post_id)?.zoo_id : null]).filter((id): id is number => !!id))];
  const zoos = zooIds.length
    ? all<ZooRow>(db, `${ZOO_SELECT} WHERE z.status = 'published' AND z.id IN (${placeholders(zooIds.length)})`, ...zooIds)
    : [];
  const zooById = new Map(loadZooSummaries(db, zoos).map((z) => [z.id, z]));

  const habitatIds = [...new Set(rows.flatMap((e) => (e.habitat_id ? [e.habitat_id] : [])))];
  const habitats = habitatIds.length
    ? all<HabitatRow>(db, `SELECT * FROM habitats WHERE id IN (${placeholders(habitatIds.length)})`, ...habitatIds)
    : [];
  const habitatById = new Map(habitats.map((h) => [h.id, h]));
  const photosByHabitat = loadPhotos(db, habitatIds);

  const surveyIds = [...new Set(rows.flatMap((e) => (e.survey_id ? [e.survey_id] : [])))];
  const surveys = surveyIds.length
    ? all<{ id: number; question: string; is_open: number; votes: number; options: number }>(
        db,
        `SELECT s.id, s.question, s.is_open,
           (SELECT COUNT(*) FROM survey_votes v WHERE v.survey_id = s.id) AS votes,
           (SELECT COUNT(*) FROM survey_options o WHERE o.survey_id = s.id) AS options
         FROM surveys s WHERE s.id IN (${placeholders(surveyIds.length)})`,
        ...surveyIds,
      )
    : [];
  const surveyById = new Map(surveys.map((s) => [s.id, s]));

  const ids = placeholders(eventIds.length);
  const likeCounts = new Map(
    all<{ event_id: number; n: number }>(db, `SELECT event_id, COUNT(*) AS n FROM likes WHERE event_id IN (${ids}) GROUP BY event_id`, ...eventIds).map((r) => [
      r.event_id,
      r.n,
    ]),
  );
  const likedByMe = new Set(
    viewerId ? all<{ event_id: number }>(db, `SELECT event_id FROM likes WHERE user_id = ? AND event_id IN (${ids})`, viewerId, ...eventIds).map((r) => r.event_id) : [],
  );
  const likers = all<{ event_id: number; id: number; username: string; display_name: string; avatar_color: string }>(
    db,
    `SELECT event_id, id, username, display_name, avatar_color FROM (
       SELECT l.event_id, u.id, u.username, u.display_name, u.avatar_color,
         ROW_NUMBER() OVER (PARTITION BY l.event_id ORDER BY l.created_at DESC, u.id DESC) AS rn
       FROM likes l JOIN users u ON u.id = l.user_id WHERE l.event_id IN (${ids})
     ) WHERE rn <= 3`,
    ...eventIds,
  );
  const likersByEvent = new Map<number, UserSummary[]>();
  for (const l of likers) likersByEvent.set(l.event_id, [...(likersByEvent.get(l.event_id) ?? []), toUserSummary(l)]);

  const commentCounts = new Map(
    all<{ event_id: number; n: number }>(db, `SELECT event_id, COUNT(*) AS n FROM comments WHERE event_id IN (${ids}) GROUP BY event_id`, ...eventIds).map(
      (r) => [r.event_id, r.n],
    ),
  );
  const commentRows = opts.allComments
    ? all<CommentRow>(db, `${COMMENT_SELECT} WHERE c.event_id IN (${ids}) ORDER BY c.id`, ...eventIds)
    : all<CommentRow>(
        db,
        `SELECT * FROM (
           SELECT c.*, u.username, u.display_name, u.avatar_color,
             ROW_NUMBER() OVER (PARTITION BY c.event_id ORDER BY c.id DESC) AS rn
           FROM comments c JOIN users u ON u.id = c.user_id WHERE c.event_id IN (${ids})
         ) WHERE rn <= 2 ORDER BY id`,
        ...eventIds,
      );

  const items: FeedItem[] = [];
  for (const e of rows) {
    const row = e.post_id ? postById.get(e.post_id) : undefined;
    const zoo = (row ? (row.zoo_id ? zooById.get(row.zoo_id) : undefined) : e.zoo_id ? zooById.get(e.zoo_id) : undefined) ?? null;
    if (!row && !zoo) continue; // park activity whose park isn't public
    const h = e.habitat_id ? habitatById.get(e.habitat_id) : undefined;
    const s = e.survey_id ? surveyById.get(e.survey_id) : undefined;
    const habitatPhotos = h ? (photosByHabitat.get(h.id) ?? []) : [];
    let photos: Photo[] = habitatPhotos.slice(0, 4);
    if (e.type === 'photos_added') {
      const wanted = new Set((JSON.parse(e.data) as { photoIds?: number[] }).photoIds ?? []);
      photos = habitatPhotos.filter((p) => wanted.has(p.id)).slice(-8);
      if (!photos.length) continue; // every photo in this entry was removed since
    }
    const post: FeedPost | null = row
      ? {
          id: row.id,
          kind: row.kind,
          body: row.body,
          photos: postPhotos.filter((p) => p.post_id === row.id).map((p) => ({ id: p.id, url: p.url, caption: '', createdAt: row.created_at })),
        }
      : null;
    items.push({
      id: e.id,
      type: e.type,
      createdAt: e.created_at,
      actor: toUserSummary({ id: e.actor_id, username: e.username, display_name: e.display_name, avatar_color: e.avatar_color }),
      zoo,
      habitat: h
        ? {
            id: h.id,
            name: h.name,
            species: h.species,
            kind: h.kind,
            status: h.status,
            color: h.color,
            description: h.description,
            points: JSON.parse(h.points) as Point[],
          }
        : null,
      photos,
      survey: s ? { id: s.id, question: s.question, isOpen: !!s.is_open, totalVotes: s.votes, optionCount: s.options } : null,
      post,
      likes: likeCounts.get(e.id) ?? 0,
      liked: likedByMe.has(e.id),
      likedBy: likersByEvent.get(e.id) ?? [],
      commentCount: commentCounts.get(e.id) ?? 0,
      comments: commentRows.filter((c) => c.event_id === e.id).map((c) => toComment(c, viewerId, e.actor_id)),
      canDelete: !!row && viewerId === e.actor_id,
    });
  }
  return items;
}
