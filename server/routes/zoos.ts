import { Router, type RequestHandler } from 'express';
import type multer from 'multer';
import { HABITAT_COLORS, KIND_META } from '../../shared/constants';
import { bounds, clampPoint, roundPoint, type Point } from '../../shared/geometry';
import { all, one, placeholders, run, tx, type DB } from '../db';
import { recordEvent } from '../events';
import { badRequest, forbidden, notFound, paramId, parse, requireUser } from '../http';
import {
  canView,
  getZooRow,
  loadHabitat,
  loadSurveys,
  loadZooDetail,
  loadZooSummaries,
  touchZoo,
  ZOO_SELECT,
  type ZooRow,
} from '../queries';
import { boardInput, habitatCreateInput, publishInput, surveyInput, zooCreateInput, zooUpdateInput } from '../schemas';
import { acceptUploads, discardUploads, removeStoredFiles } from '../uploads';

/** Clamp points into the map and round them to 10 cm so stored geometry stays tidy. */
export function normalizePoints(points: Point[], zoo: Pick<ZooRow, 'width' | 'height'>): Point[] {
  return points.map((p) => roundPoint(clampPoint(p, zoo.width, zoo.height)));
}

export function createSurvey(db: DB, zooId: number, input: ReturnType<typeof surveyInput.parse>) {
  const { id } = run(db, 'INSERT INTO surveys (zoo_id, question, allow_suggestions) VALUES (?, ?, ?)', zooId, input.question, input.allowSuggestions ? 1 : 0);
  for (const label of input.options) run(db, 'INSERT INTO survey_options (survey_id, label) VALUES (?, ?)', id, label);
  return id;
}

export function zooRoutes(db: DB, upload: multer.Multer, uploadDir: string) {
  const r = Router();

  const ownZoo = (userId: number, zooId: number) => {
    const zoo = getZooRow(db, zooId);
    if (!zoo || !canView(zoo, userId)) throw notFound('Zoo not found');
    if (zoo.owner_id !== userId) throw forbidden('Only the owner can change this zoo');
    return zoo;
  };

  r.get('/mine', (req, res) => {
    const me = requireUser(req);
    const zoos = all<ZooRow>(db, `${ZOO_SELECT} WHERE z.owner_id = ? ORDER BY z.updated_at DESC`, me.id);
    res.json(loadZooSummaries(db, zoos));
  });

  r.get('/explore', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const zoos = q
      ? all<ZooRow>(
          db,
          `${ZOO_SELECT} WHERE z.status = 'published'
           AND (z.title LIKE ? ESCAPE '\\' OR z.description LIKE ? ESCAPE '\\' OR u.username LIKE ? ESCAPE '\\'
                OR EXISTS (SELECT 1 FROM habitats h WHERE h.zoo_id = z.id AND (h.species LIKE ? ESCAPE '\\' OR h.name LIKE ? ESCAPE '\\')))
           ORDER BY z.published_at DESC LIMIT 60`,
          like,
          like,
          like,
          like,
          like,
        )
      : all<ZooRow>(db, `${ZOO_SELECT} WHERE z.status = 'published' ORDER BY z.published_at DESC LIMIT 60`);
    res.json(loadZooSummaries(db, zoos));
  });

  r.post('/', (req, res) => {
    const me = requireUser(req);
    const body = parse(zooCreateInput, req.body);
    const { id } = run(
      db,
      'INSERT INTO zoos (owner_id, title, description, width, height) VALUES (?, ?, ?, ?, ?)',
      me.id,
      body.title,
      body.description,
      Math.round(body.width),
      Math.round(body.height),
    );
    res.status(201).json(loadZooDetail(db, getZooRow(db, id)!, me.id));
  });

  r.get('/:id', (req, res) => {
    const zoo = getZooRow(db, paramId(req));
    if (!zoo || !canView(zoo, req.user?.id)) throw notFound('Zoo not found');
    res.json(loadZooDetail(db, zoo, req.user?.id));
  });

  r.patch('/:id', (req, res) => {
    const me = requireUser(req);
    const zoo = ownZoo(me.id, paramId(req));
    const body = parse(zooUpdateInput, req.body);
    const width = body.width !== undefined ? Math.round(body.width) : zoo.width;
    const height = body.height !== undefined ? Math.round(body.height) : zoo.height;
    if (width < zoo.width || height < zoo.height) {
      const pts = all<{ points: string }>(db, 'SELECT points FROM habitats WHERE zoo_id = ?', zoo.id).flatMap(
        (h) => JSON.parse(h.points) as Point[],
      );
      if (pts.length) {
        const b = bounds(pts);
        if (b.maxX > width || b.maxY > height) {
          throw badRequest(`Some shapes reach ${Math.ceil(b.maxX)} × ${Math.ceil(b.maxY)} m — move them before shrinking the map`);
        }
      }
    }
    run(
      db,
      `UPDATE zoos SET title = ?, description = ?, width = ?, height = ?, background_opacity = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
      body.title ?? zoo.title,
      body.description ?? zoo.description,
      width,
      height,
      body.backgroundOpacity ?? zoo.background_opacity,
      zoo.id,
    );
    res.json(loadZooDetail(db, getZooRow(db, zoo.id)!, me.id));
  });

  r.delete('/:id', (req, res) => {
    const me = requireUser(req);
    const zoo = ownZoo(me.id, paramId(req));
    const photoUrls = all<{ url: string }>(
      db,
      'SELECT p.url FROM photos p JOIN habitats h ON h.id = p.habitat_id WHERE h.zoo_id = ?',
      zoo.id,
    ).map((p) => p.url);
    run(db, 'DELETE FROM zoos WHERE id = ?', zoo.id);
    removeStoredFiles(uploadDir, [...photoUrls, zoo.background_url]);
    res.json({ ok: true });
  });

  // Check ownership before multer writes anything to disk.
  const ownerOnly: RequestHandler = (req, _res, next) => {
    ownZoo(requireUser(req).id, paramId(req));
    next();
  };

  r.put('/:id/background', ownerOnly, upload.single('image'), (req, res) => {
    const files = req.file ? [req.file] : [];
    try {
      const me = requireUser(req);
      const zoo = ownZoo(me.id, paramId(req));
      if (!files.length) throw badRequest('Choose an image to upload');
      const [url] = acceptUploads(files);
      run(db, 'UPDATE zoos SET background_url = ? WHERE id = ?', url, zoo.id);
      removeStoredFiles(uploadDir, [zoo.background_url]);
      touchZoo(db, zoo.id);
      res.json(loadZooDetail(db, getZooRow(db, zoo.id)!, me.id));
    } catch (err) {
      discardUploads(files);
      throw err;
    }
  });

  r.delete('/:id/background', (req, res) => {
    const me = requireUser(req);
    const zoo = ownZoo(me.id, paramId(req));
    run(db, 'UPDATE zoos SET background_url = NULL WHERE id = ?', zoo.id);
    removeStoredFiles(uploadDir, [zoo.background_url]);
    touchZoo(db, zoo.id);
    res.json(loadZooDetail(db, getZooRow(db, zoo.id)!, me.id));
  });

  r.post('/:id/publish', (req, res) => {
    const me = requireUser(req);
    const zoo = ownZoo(me.id, paramId(req));
    const body = parse(publishInput, req.body ?? {});
    tx(db, () => {
      run(
        db,
        `UPDATE zoos SET status = 'published', published_at = COALESCE(published_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
        zoo.id,
      );
      const surveyId = body.survey ? createSurvey(db, zoo.id, body.survey) : null;
      const announced = one(db, "SELECT 1 FROM events WHERE zoo_id = ? AND type = 'zoo_published'", zoo.id);
      if (!announced) recordEvent(db, { actorId: me.id, type: 'zoo_published', zooId: zoo.id, surveyId });
      else if (surveyId) recordEvent(db, { actorId: me.id, type: 'survey_created', zooId: zoo.id, surveyId });
    });
    res.json(loadZooDetail(db, getZooRow(db, zoo.id)!, me.id));
  });

  r.post('/:id/unpublish', (req, res) => {
    const me = requireUser(req);
    const zoo = ownZoo(me.id, paramId(req));
    run(db, "UPDATE zoos SET status = 'draft', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?", zoo.id);
    res.json(loadZooDetail(db, getZooRow(db, zoo.id)!, me.id));
  });

  r.post('/:id/habitats', (req, res) => {
    const me = requireUser(req);
    const zoo = ownZoo(me.id, paramId(req));
    const body = parse(habitatCreateInput, req.body);
    const count = one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM habitats WHERE zoo_id = ?', zoo.id)!.n;
    if (count >= 500) throw badRequest('A zoo can have at most 500 shapes');
    const color = body.color ?? (body.kind === 'habitat' ? HABITAT_COLORS[count % 6] : KIND_META[body.kind].color);
    const position = one<{ p: number | null }>(db, 'SELECT MAX(position) AS p FROM habitats WHERE zoo_id = ? AND status = ?', zoo.id, body.status)!.p;
    const { id } = run(
      db,
      `INSERT INTO habitats (zoo_id, name, kind, status, biome, species, description, color, points, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      zoo.id,
      body.name,
      body.kind,
      body.status,
      body.biome,
      body.species,
      body.description,
      color,
      JSON.stringify(normalizePoints(body.points, zoo)),
      (position ?? -1) + 1,
    );
    touchZoo(db, zoo.id);
    recordEvent(db, { actorId: me.id, type: 'habitat_added', zooId: zoo.id, habitatId: id });
    res.status(201).json(loadHabitat(db, id));
  });

  // Kanban board: set the status and order of many habitats at once.
  r.put('/:id/board', (req, res) => {
    const me = requireUser(req);
    const zoo = ownZoo(me.id, paramId(req));
    const { columns } = parse(boardInput, req.body);
    const ids = Object.values(columns).flat();
    if (ids.length) {
      const found = all<{ id: number }>(
        db,
        `SELECT id FROM habitats WHERE zoo_id = ? AND id IN (${placeholders(ids.length)})`,
        zoo.id,
        ...ids,
      );
      if (found.length !== new Set(ids).size) throw badRequest('Some habitats do not belong to this zoo');
    }
    tx(db, () => {
      for (const [status, list] of Object.entries(columns)) {
        list.forEach((id, position) =>
          run(
            db,
            "UPDATE habitats SET status = ?, position = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
            status,
            position,
            id,
          ),
        );
      }
      touchZoo(db, zoo.id);
    });
    res.json(loadZooDetail(db, getZooRow(db, zoo.id)!, me.id).habitats);
  });

  r.post('/:id/surveys', (req, res) => {
    const me = requireUser(req);
    const zoo = ownZoo(me.id, paramId(req));
    const body = parse(surveyInput, req.body);
    const surveyId = tx(db, () => {
      const id = createSurvey(db, zoo.id, body);
      recordEvent(db, { actorId: me.id, type: 'survey_created', zooId: zoo.id, surveyId: id });
      return id;
    });
    res.status(201).json(loadSurveys(db, zoo, me.id, surveyId)[0]);
  });

  return r;
}
