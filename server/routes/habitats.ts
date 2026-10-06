import { Router, type RequestHandler } from 'express';
import type multer from 'multer';
import { LIMITS } from '../../shared/constants';
import type { Point } from '../../shared/geometry';
import { all, one, run, tx, type DB } from '../db';
import { recordPhotosAdded } from '../events';
import { badRequest, forbidden, notFound, paramId, parse, requireUser } from '../http';
import { checkGeometry, checkShapeFits } from '../parks';
import { canView, getHabitatWithZoo, loadHabitat, touchZoo } from '../queries';
import { habitatUpdateInput, photoUpdateInput, photoUrlInput } from '../schemas';
import { acceptUploads, discardUploads, removeStoredFiles } from '../uploads';
import { normalizePoints } from './zoos';

export function habitatRoutes(db: DB, upload: multer.Multer, uploadDir: string) {
  const r = Router();

  const ownHabitat = (userId: number, habitatId: number) => {
    const found = getHabitatWithZoo(db, habitatId);
    if (!found || !canView(found.zoo, userId)) throw notFound('Shape not found');
    if (found.zoo.owner_id !== userId) throw forbidden('Only the park owner can change this');
    return found;
  };

  const ownPhoto = (userId: number, photoId: number) => {
    const photo = one<{ id: number; habitat_id: number; url: string }>(db, 'SELECT id, habitat_id, url FROM photos WHERE id = ?', photoId);
    if (!photo) throw notFound('Photo not found');
    return { photo, ...ownHabitat(userId, photo.habitat_id) };
  };

  r.patch('/habitats/:id', (req, res) => {
    const me = requireUser(req);
    const { habitat, zoo } = ownHabitat(me.id, paramId(req));
    const body = parse(habitatUpdateInput, req.body);
    checkShapeFits(zoo.park_type, body.kind, body.biome);
    if (body.kind || body.points) checkGeometry(body.kind ?? habitat.kind, body.points ?? (JSON.parse(habitat.points) as Point[]), habitat.kind);
    const next = {
      name: body.name ?? habitat.name,
      kind: body.kind ?? habitat.kind,
      status: body.status ?? habitat.status,
      biome: body.biome ?? habitat.biome,
      species: body.species ?? habitat.species,
      description: body.description ?? habitat.description,
      reason: body.reason ?? habitat.reason,
      color: body.color ?? habitat.color,
      points: body.points ? JSON.stringify(normalizePoints(body.points, zoo)) : habitat.points,
    };
    run(
      db,
      `UPDATE habitats SET name = ?, kind = ?, status = ?, biome = ?, species = ?, description = ?, reason = ?, color = ?, points = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
      next.name,
      next.kind,
      next.status,
      next.biome,
      next.species,
      next.description,
      next.reason,
      next.color,
      next.points,
      habitat.id,
    );
    touchZoo(db, zoo.id);
    res.json(loadHabitat(db, habitat.id));
  });

  r.delete('/habitats/:id', (req, res) => {
    const me = requireUser(req);
    const { habitat, zoo } = ownHabitat(me.id, paramId(req));
    const urls = all<{ url: string }>(db, 'SELECT url FROM photos WHERE habitat_id = ?', habitat.id).map((p) => p.url);
    run(db, 'DELETE FROM habitats WHERE id = ?', habitat.id);
    removeStoredFiles(uploadDir, urls);
    touchZoo(db, zoo.id);
    res.json({ ok: true });
  });

  // Check ownership before multer writes anything to disk.
  const ownerOnly: RequestHandler = (req, _res, next) => {
    ownHabitat(requireUser(req).id, paramId(req));
    next();
  };

  // Accepts either multipart uploads (field "photos") or JSON { url, caption } for a linked image.
  r.post('/habitats/:id/photos', ownerOnly, upload.array('photos', 12), (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    try {
      const me = requireUser(req);
      const { habitat, zoo } = ownHabitat(me.id, paramId(req));
      const existing = one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM photos WHERE habitat_id = ?', habitat.id)!.n;
      let entries: { url: string; caption: string }[];
      if (files.length) {
        const caption = typeof req.body?.caption === 'string' ? req.body.caption.trim().slice(0, 200) : '';
        if (existing + files.length > LIMITS.photosPerHabitat) throw badRequest(`A habitat can hold up to ${LIMITS.photosPerHabitat} photos`);
        entries = acceptUploads(files).map((url) => ({ url, caption }));
      } else {
        if (existing + 1 > LIMITS.photosPerHabitat) throw badRequest(`A habitat can hold up to ${LIMITS.photosPerHabitat} photos`);
        entries = [parse(photoUrlInput, req.body)];
      }
      const ids = tx(db, () => entries.map((e) => run(db, 'INSERT INTO photos (habitat_id, url, caption) VALUES (?, ?, ?)', habitat.id, e.url, e.caption).id));
      touchZoo(db, zoo.id);
      recordPhotosAdded(db, me.id, zoo.id, habitat.id, ids);
      res.status(201).json(loadHabitat(db, habitat.id));
    } catch (err) {
      discardUploads(files);
      throw err;
    }
  });

  r.patch('/photos/:id', (req, res) => {
    const me = requireUser(req);
    const { photo } = ownPhoto(me.id, paramId(req));
    const body = parse(photoUpdateInput, req.body);
    run(db, 'UPDATE photos SET caption = ? WHERE id = ?', body.caption, photo.id);
    res.json(loadHabitat(db, photo.habitat_id));
  });

  r.delete('/photos/:id', (req, res) => {
    const me = requireUser(req);
    const { photo, zoo } = ownPhoto(me.id, paramId(req));
    run(db, 'DELETE FROM photos WHERE id = ?', photo.id);
    removeStoredFiles(uploadDir, [photo.url]);
    touchZoo(db, zoo.id);
    res.json(loadHabitat(db, photo.habitat_id));
  });

  return r;
}
