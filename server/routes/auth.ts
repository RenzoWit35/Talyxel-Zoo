import { Router } from 'express';
import { AVATAR_COLORS } from '../../shared/constants';
import type { Me } from '../../shared/types';
import { createSession, destroySession, hashPassword, rateLimit, SESSION_COOKIE, setSessionCookie, verifyPassword } from '../auth';
import { one, run, type DB } from '../db';
import { HttpError, parse, requireUser } from '../http';
import { loginInput, profileInput, registerInput } from '../schemas';

interface CredentialRow {
  id: number;
  password_hash: string;
}

// Verified against when the username doesn't exist, so both paths cost the same time.
const DUMMY_HASH = hashPassword('not-a-real-password');

export function authRoutes(db: DB) {
  const r = Router();
  const limiter = rateLimit({ windowMs: 10 * 60_000, max: 30 });

  const loadMe = (id: number): Me => {
    const u = one<{ id: number; username: string; display_name: string; avatar_color: string; bio: string }>(
      db,
      'SELECT id, username, display_name, avatar_color, bio FROM users WHERE id = ?',
      id,
    )!;
    return { id: u.id, username: u.username, displayName: u.display_name, avatarColor: u.avatar_color, bio: u.bio };
  };

  r.post('/register', limiter, async (req, res) => {
    const body = parse(registerInput, req.body);
    if (one(db, 'SELECT 1 FROM users WHERE username = ?', body.username)) {
      throw new HttpError(409, 'That username is already taken');
    }
    const hash = await hashPassword(body.password);
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    let id: number;
    try {
      ({ id } = run(
        db,
        'INSERT INTO users (username, display_name, password_hash, avatar_color) VALUES (?, ?, ?, ?)',
        body.username,
        body.displayName || body.username,
        hash,
        color,
      ));
    } catch (err) {
      if (String((err as Error).message).includes('UNIQUE')) throw new HttpError(409, 'That username is already taken');
      throw err;
    }
    const session = createSession(db, id);
    setSessionCookie(req, res, session.token, session.expires);
    res.status(201).json(loadMe(id));
  });

  r.post('/login', limiter, async (req, res) => {
    const body = parse(loginInput, req.body);
    const user = one<CredentialRow>(db, 'SELECT id, password_hash FROM users WHERE username = ?', body.username);
    const ok = await verifyPassword(body.password, user?.password_hash ?? (await DUMMY_HASH));
    if (!user || !ok) throw new HttpError(401, 'Wrong username or password');
    const session = createSession(db, user.id);
    setSessionCookie(req, res, session.token, session.expires);
    res.json(loadMe(user.id));
  });

  r.post('/logout', (req, res) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string') destroySession(db, token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  r.get('/me', (req, res) => {
    res.json(req.user ? loadMe(req.user.id) : null);
  });

  r.patch('/me', (req, res) => {
    const me = requireUser(req);
    const body = parse(profileInput, req.body);
    if (body.displayName !== undefined) run(db, 'UPDATE users SET display_name = ? WHERE id = ?', body.displayName, me.id);
    if (body.bio !== undefined) run(db, 'UPDATE users SET bio = ? WHERE id = ?', body.bio, me.id);
    if (body.avatarColor !== undefined) run(db, 'UPDATE users SET avatar_color = ? WHERE id = ?', body.avatarColor, me.id);
    res.json(loadMe(me.id));
  });

  return r;
}
