import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app';
import { openDb, run } from './db';

/** TRUST_PROXY: "true", a hop count like "1", or an address list like "loopback, 10.0.0.0/8". */
function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (!value) return 'loopback';
  if (value === 'true' || value === 'false') return value === 'true';
  return /^\d+$/.test(value) ? Number(value) : value;
}

const port = Number(process.env.PORT ?? 3001);
const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');
mkdirSync(dataDir, { recursive: true });

const db = openDb(path.join(dataDir, 'talyxel.db'));
const app = createApp({
  db,
  uploadDir: path.join(dataDir, 'uploads'),
  staticDir: path.resolve('dist'),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
});

const cleanSessions = () => run(db, "DELETE FROM sessions WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
cleanSessions();
setInterval(cleanSessions, 6 * 60 * 60 * 1000).unref();

app.listen(port, () => {
  console.log(`Talyxel Zoo API listening on http://localhost:${port}`);
});
