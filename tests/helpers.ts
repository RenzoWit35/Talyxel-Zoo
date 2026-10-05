import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../server/app';
import { openDb, type DB } from '../server/db';

const openDbs: DB[] = [];

/** Close every database the tests opened (see tests/setup.ts); open SQLite handles can crash the worker on exit. */
export function closeDatabases() {
  for (const db of openDbs.splice(0)) if (db.isOpen) db.close();
}

export function makeApp() {
  const db = openDb(':memory:');
  openDbs.push(db);
  const uploadDir = mkdtempSync(path.join(tmpdir(), 'talyxel-test-'));
  const app = createApp({ db, uploadDir });
  return { app, db, uploadDir };
}

export type TestApp = ReturnType<typeof makeApp>['app'];

/** A logged-in client: a supertest agent that keeps cookies and sends the CSRF header. */
export async function signUp(app: TestApp, username: string, password = 'correct-horse') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').set('x-talyxel', '1').send({ username, password, displayName: username.toUpperCase() });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const send = (method: 'post' | 'patch' | 'put' | 'delete', url: string, body?: object) =>
    agent[method](url).set('x-talyxel', '1').send(body);
  return {
    agent,
    user: res.body as { id: number; username: string },
    get: (url: string) => agent.get(url),
    post: (url: string, body?: object) => send('post', url, body),
    patch: (url: string, body?: object) => send('patch', url, body),
    put: (url: string, body?: object) => send('put', url, body),
    del: (url: string) => send('delete', url),
  };
}

export const square = (x: number, y: number, size: number): [number, number][] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
];

/** Smallest valid PNG (1×1, transparent). */
export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
