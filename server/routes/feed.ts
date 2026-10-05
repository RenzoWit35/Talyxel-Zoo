import { Router } from 'express';
import type { Point } from '../../shared/geometry';
import type { FeedEventType, FeedItem, FeedPage } from '../../shared/types';
import { all, placeholders, type DB } from '../db';
import { requireUser } from '../http';
import { loadPhotos, loadZooSummaries, toUserSummary, ZOO_SELECT, type HabitatRow, type ZooRow } from '../queries';

interface EventRow {
  id: number;
  actor_id: number;
  type: FeedEventType;
  zoo_id: number;
  habitat_id: number | null;
  survey_id: number | null;
  data: string;
  created_at: string;
  username: string;
  display_name: string;
  avatar_color: string;
}

const PAGE_SIZE = 20;

export function feedRoutes(db: DB) {
  const r = Router();

  // What you and the people you follow have been adding to their published zoos.
  r.get('/', (req, res) => {
    const me = requireUser(req);
    const before = Number(req.query.before);
    const cursor = Number.isInteger(before) && before > 0 ? before : null;
    const rows = all<EventRow>(
      db,
      `SELECT e.*, u.username, u.display_name, u.avatar_color
       FROM events e
       JOIN zoos z ON z.id = e.zoo_id AND z.status = 'published'
       JOIN users u ON u.id = e.actor_id
       WHERE (e.actor_id = ? OR e.actor_id IN (SELECT followee_id FROM follows WHERE follower_id = ?))
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

    const zooIds = [...new Set(page.map((e) => e.zoo_id))];
    const zoos = zooIds.length ? all<ZooRow>(db, `${ZOO_SELECT} WHERE z.id IN (${placeholders(zooIds.length)})`, ...zooIds) : [];
    const zooById = new Map(loadZooSummaries(db, zoos).map((z) => [z.id, z]));

    const habitatIds = [...new Set(page.flatMap((e) => (e.habitat_id ? [e.habitat_id] : [])))];
    const habitats = habitatIds.length
      ? all<HabitatRow>(db, `SELECT * FROM habitats WHERE id IN (${placeholders(habitatIds.length)})`, ...habitatIds)
      : [];
    const habitatById = new Map(habitats.map((h) => [h.id, h]));
    const photosByHabitat = loadPhotos(db, habitatIds);

    const surveyIds = [...new Set(page.flatMap((e) => (e.survey_id ? [e.survey_id] : [])))];
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

    const items: FeedItem[] = [];
    for (const e of page) {
      const zoo = zooById.get(e.zoo_id);
      if (!zoo) continue;
      const h = e.habitat_id ? habitatById.get(e.habitat_id) : undefined;
      const s = e.survey_id ? surveyById.get(e.survey_id) : undefined;
      const habitatPhotos = h ? (photosByHabitat.get(h.id) ?? []) : [];
      let photos = habitatPhotos.slice(0, 4);
      if (e.type === 'photos_added') {
        const wanted = new Set((JSON.parse(e.data) as { photoIds?: number[] }).photoIds ?? []);
        photos = habitatPhotos.filter((p) => wanted.has(p.id)).slice(-8);
        if (!photos.length) continue; // every photo in this entry was removed since
      }
      items.push({
        id: e.id,
        type: e.type,
        createdAt: e.created_at,
        actor: toUserSummary(e),
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
      });
    }
    const body: FeedPage = { items, nextCursor };
    res.json(body);
  });

  return r;
}
