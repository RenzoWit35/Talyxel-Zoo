import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { one, run, type DB } from './db';
import { HttpError } from './http';

export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  avatarColor: string;
  bio: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export const SESSION_COOKIE = 'tz_session';
const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(key, expected);
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function createSession(db: DB, userId: number) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  run(db, 'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', hashToken(token), userId, expires.toISOString());
  return { token, expires };
}

export function destroySession(db: DB, token: string) {
  run(db, 'DELETE FROM sessions WHERE token_hash = ?', hashToken(token));
}

export function setSessionCookie(req: Request, res: Response, token: string, expires: Date) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    expires,
    path: '/',
  });
}

interface SessionRow {
  id: number;
  username: string;
  display_name: string;
  avatar_color: string;
  bio: string;
  expires_at: string;
}

/** Loads req.user from the session cookie when present and valid. */
export function sessionMiddleware(db: DB) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token) {
      const row = one<SessionRow>(
        db,
        `SELECT u.id, u.username, u.display_name, u.avatar_color, u.bio, s.expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
        hashToken(token),
      );
      if (row && new Date(row.expires_at) > new Date()) {
        req.user = {
          id: row.id,
          username: row.username,
          displayName: row.display_name,
          avatarColor: row.avatar_color,
          bio: row.bio,
        };
      } else {
        if (row) destroySession(db, token);
        res.clearCookie(SESSION_COOKIE, { path: '/' });
      }
    }
    next();
  };
}

/**
 * CSRF guard: state-changing API calls must carry a custom header, which browsers
 * refuse to attach to cross-site requests without a CORS preflight we never approve.
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-talyxel') !== '1') return next(new HttpError(403, 'Missing request header'));
  next();
}

/** Tiny fixed-window rate limiter for login / register, keyed by client IP. */
export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset < now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    if (entry.count > max) return next(new HttpError(429, 'Too many attempts, please wait a few minutes'));
    next();
  };
}
