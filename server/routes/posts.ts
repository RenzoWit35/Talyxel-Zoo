import { Router, type RequestHandler } from 'express';
import type multer from 'multer';
import { POST_LIMITS } from '../../shared/constants';
import { all, one, run, tx, type DB } from '../db';
import { recordPost } from '../events';
import { buildFeedItems, getVisibleEvent, likeState, loadAllComments, loadComment, toComment, type EventRow } from '../feed-items';
import { badRequest, forbidden, notFound, paramId, parse, requireUser } from '../http';
import { notify, unnotify } from '../notify';
import { commentInput, postInput } from '../schemas';
import { acceptUploads, discardUploads, removeStoredFiles } from '../uploads';

export function postRoutes(db: DB, upload: multer.Multer, uploadDir: string) {
  const r = Router();

  const visibleEvent = (id: number) => {
    const event = getVisibleEvent(db, id);
    if (!event) throw notFound('Post not found');
    return event;
  };

  const item = (event: EventRow, viewerId: number | undefined, allComments = false) => {
    const [found] = buildFeedItems(db, [event], viewerId, { allComments });
    if (!found) throw notFound('Post not found');
    return found;
  };

  // Logged-in users only, checked before multer writes anything to disk.
  const loggedIn: RequestHandler = (req, _res, next) => {
    requireUser(req);
    next();
  };

  /** Share an update or ask a question. Multipart with up to 10 "photos", or plain JSON without photos. */
  r.post('/posts', loggedIn, upload.array('photos', POST_LIMITS.photos + 1), (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    try {
      const me = requireUser(req);
      const body = parse(postInput, req.body ?? {});
      if (files.length > POST_LIMITS.photos) throw badRequest(`A post can have at most ${POST_LIMITS.photos} photos`);
      if (body.kind === 'question' && body.body.length < 3) throw badRequest('Ask your question in at least 3 characters');
      if (body.kind === 'update' && !body.body && !files.length) throw badRequest('Write something or add a photo');
      if (body.zooId) {
        const zoo = one<{ owner_id: number; status: string }>(db, 'SELECT owner_id, status FROM zoos WHERE id = ?', body.zooId);
        if (!zoo || zoo.owner_id !== me.id) throw badRequest('You can only link your own parks');
        if (zoo.status !== 'published') throw badRequest('Publish the park first so your followers can open it');
      }
      const urls = files.length ? acceptUploads(files) : [];
      const eventId = tx(db, () => {
        const postId = run(db, 'INSERT INTO posts (user_id, kind, body, zoo_id) VALUES (?, ?, ?, ?)', me.id, body.kind, body.body, body.zooId ?? null).id;
        urls.forEach((url, position) => run(db, 'INSERT INTO post_photos (post_id, url, position) VALUES (?, ?, ?)', postId, url, position));
        return recordPost(db, me.id, postId);
      });
      res.status(201).json(item(visibleEvent(eventId), me.id));
    } catch (err) {
      discardUploads(files);
      throw err;
    }
  });

  r.get('/activity/:id', (req, res) => {
    res.json(item(visibleEvent(paramId(req)), req.user?.id, true));
  });

  // Only posts can be deleted; park activity goes away with the park, shape or photos it's about.
  r.delete('/activity/:id', (req, res) => {
    const me = requireUser(req);
    const event = visibleEvent(paramId(req));
    if (!event.post_id) throw badRequest('Only posts can be deleted — this card follows the park');
    if (event.actor_id !== me.id) throw forbidden('You can only delete your own posts');
    const urls = all<{ url: string }>(db, 'SELECT url FROM post_photos WHERE post_id = ?', event.post_id).map((p) => p.url);
    run(db, 'DELETE FROM posts WHERE id = ?', event.post_id);
    removeStoredFiles(uploadDir, urls);
    res.json({ ok: true });
  });

  r.put('/activity/:id/like', (req, res) => {
    const me = requireUser(req);
    const event = visibleEvent(paramId(req));
    const { changes } = run(db, 'INSERT OR IGNORE INTO likes (event_id, user_id) VALUES (?, ?)', event.id, me.id);
    if (changes) notify(db, { userId: event.actor_id, actorId: me.id, type: 'like', eventId: event.id });
    res.json(likeState(db, event.id, me.id));
  });

  r.delete('/activity/:id/like', (req, res) => {
    const me = requireUser(req);
    const event = visibleEvent(paramId(req));
    run(db, 'DELETE FROM likes WHERE event_id = ? AND user_id = ?', event.id, me.id);
    unnotify(db, { userId: event.actor_id, actorId: me.id, type: 'like', eventId: event.id });
    res.json(likeState(db, event.id, me.id));
  });

  r.get('/activity/:id/comments', (req, res) => {
    const event = visibleEvent(paramId(req));
    res.json(loadAllComments(db, event, req.user?.id));
  });

  r.post('/activity/:id/comments', (req, res) => {
    const me = requireUser(req);
    const event = visibleEvent(paramId(req));
    const { body } = parse(commentInput, req.body);
    const { id } = run(db, 'INSERT INTO comments (event_id, user_id, body) VALUES (?, ?, ?)', event.id, me.id, body);
    notify(db, { userId: event.actor_id, actorId: me.id, type: 'comment', eventId: event.id, commentId: id });
    res.status(201).json(toComment(loadComment(db, id)!, me.id, event.actor_id));
  });

  // The comment's author or the owner of what it's on can remove it.
  r.delete('/comments/:id', (req, res) => {
    const me = requireUser(req);
    const comment = loadComment(db, paramId(req));
    const event = comment && getVisibleEvent(db, comment.event_id);
    if (!comment || !event) throw notFound('Comment not found');
    if (comment.user_id !== me.id && event.actor_id !== me.id) throw forbidden('You can only delete your own comments');
    run(db, 'DELETE FROM comments WHERE id = ?', comment.id);
    res.json({ ok: true });
  });

  return r;
}
