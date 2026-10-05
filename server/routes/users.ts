import { Router } from 'express';
import type { Profile } from '../../shared/types';
import { all, one, run, type DB } from '../db';
import { buildFeedItems, EVENT_SELECT, VISIBLE, type EventRow } from '../feed-items';
import { badRequest, notFound, requireUser } from '../http';
import { listUsers, loadZooSummaries, toUserSummary, ZOO_SELECT, type UserRow, type ZooRow } from '../queries';

export function userRoutes(db: DB) {
  const r = Router();

  const findUser = (username: unknown) => {
    if (typeof username !== 'string') throw notFound('User not found');
    const user = one<UserRow>(db, 'SELECT id, username, display_name, avatar_color, bio, created_at FROM users WHERE username = ?', username);
    if (!user) throw notFound('User not found');
    return user;
  };

  // Search people by username or display name; without a query, list the most followed.
  r.get('/', (req, res) => {
    const viewer = req.user?.id ?? 0;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 40) : '';
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const users = q
      ? listUsers(
          db,
          "(u.username LIKE $like ESCAPE '\\' OR u.display_name LIKE $like ESCAPE '\\')",
          'ORDER BY followers DESC, u.id LIMIT 40',
          { viewer, like },
        )
      : listUsers(db, '1 = 1', 'ORDER BY followers DESC, published_zoos DESC, u.id LIMIT 40', { viewer });
    res.json(users);
  });

  // People you might want to follow: followed by people you follow, then popular builders.
  r.get('/suggestions', (req, res) => {
    const me = requireUser(req);
    const users = listUsers(
      db,
      `u.id <> $viewer AND u.id NOT IN (SELECT followee_id FROM follows WHERE follower_id = $viewer)`,
      `ORDER BY (SELECT COUNT(*) FROM follows f2 JOIN follows mine ON mine.followee_id = f2.follower_id
                 WHERE mine.follower_id = $viewer AND f2.followee_id = u.id) DESC,
                published_zoos DESC, followers DESC, u.id DESC LIMIT 6`,
      { viewer: me.id },
    );
    res.json(users);
  });

  r.get('/:username', (req, res) => {
    const user = findUser(req.params.username);
    const viewer = req.user?.id;
    const isMe = viewer === user.id;
    const counts = one<{ followers: number; following: number }>(
      db,
      `SELECT (SELECT COUNT(*) FROM follows WHERE followee_id = ?) AS followers,
              (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following`,
      user.id,
      user.id,
    )!;
    const rel = (follower: number | undefined, followee: number) =>
      !!follower && !!one(db, 'SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?', follower, followee);
    const zoos = all<ZooRow>(
      db,
      `${ZOO_SELECT} WHERE z.owner_id = ? ${isMe ? '' : "AND z.status = 'published'"}
       ORDER BY COALESCE(z.published_at, z.updated_at) DESC`,
      user.id,
    );
    const profile: Profile = {
      ...toUserSummary(user),
      bio: user.bio,
      createdAt: user.created_at,
      followers: counts.followers,
      following: counts.following,
      isMe,
      isFollowing: rel(viewer, user.id),
      followsYou: viewer ? rel(user.id, viewer) : false,
      zoos: loadZooSummaries(db, zoos),
    };
    res.json(profile);
  });

  // A builder's own posts (not park activity), newest first — the grid on their profile.
  r.get('/:username/posts', (req, res) => {
    const user = findUser(req.params.username);
    const rows = all<EventRow>(
      db,
      `${EVENT_SELECT} WHERE e.actor_id = ? AND e.type = 'post_created' AND ${VISIBLE} ORDER BY e.id DESC LIMIT 90`,
      user.id,
    );
    res.json(buildFeedItems(db, rows, req.user?.id));
  });

  r.get('/:username/followers', (req, res) => {
    const user = findUser(req.params.username);
    res.json(
      listUsers(db, 'u.id IN (SELECT follower_id FROM follows WHERE followee_id = $target)', 'ORDER BY u.username LIMIT 500', {
        viewer: req.user?.id ?? 0,
        target: user.id,
      }),
    );
  });

  r.get('/:username/following', (req, res) => {
    const user = findUser(req.params.username);
    res.json(
      listUsers(db, 'u.id IN (SELECT followee_id FROM follows WHERE follower_id = $target)', 'ORDER BY u.username LIMIT 500', {
        viewer: req.user?.id ?? 0,
        target: user.id,
      }),
    );
  });

  r.put('/:username/follow', (req, res) => {
    const me = requireUser(req);
    const user = findUser(req.params.username);
    if (user.id === me.id) throw badRequest("You can't follow yourself");
    run(db, 'INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)', me.id, user.id);
    res.json({ following: true });
  });

  r.delete('/:username/follow', (req, res) => {
    const me = requireUser(req);
    const user = findUser(req.params.username);
    run(db, 'DELETE FROM follows WHERE follower_id = ? AND followee_id = ?', me.id, user.id);
    res.json({ following: false });
  });

  return r;
}
