import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType, SQLInputValue, StatementSync } from 'node:sqlite';

// node:sqlite is stable enough for us but still prints an ExperimentalWarning on load.
// Filter that one message out, then load the module lazily so the filter is in place first.
const originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const message = typeof warning === 'string' ? warning : warning.message;
  if (message.includes('SQLite is an experimental feature')) return;
  return (originalEmitWarning as (...args: unknown[]) => void)(warning, ...rest);
}) as typeof process.emitWarning;

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

export type DB = DatabaseSyncType;
export type Param = SQLInputValue;

const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";

/** Each entry upgrades the schema by one version (tracked with PRAGMA user_version). */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    avatar_color TEXT NOT NULL DEFAULT '#2f6b47',
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE follows (
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
  );
  CREATE INDEX follows_followee ON follows(followee_id);

  CREATE TABLE zoos (
    id INTEGER PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    width REAL NOT NULL DEFAULT 300,
    height REAL NOT NULL DEFAULT 200,
    background_url TEXT,
    background_opacity REAL NOT NULL DEFAULT 0.6,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    updated_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX zoos_owner ON zoos(owner_id);
  CREATE INDEX zoos_published ON zoos(status, published_at);

  CREATE TABLE habitats (
    id INTEGER PRIMARY KEY,
    zoo_id INTEGER NOT NULL REFERENCES zoos(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'habitat',
    status TEXT NOT NULL DEFAULT 'planned',
    biome TEXT NOT NULL DEFAULT '',
    species TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL,
    points TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    updated_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX habitats_zoo ON habitats(zoo_id);

  CREATE TABLE photos (
    id INTEGER PRIMARY KEY,
    habitat_id INTEGER NOT NULL REFERENCES habitats(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX photos_habitat ON photos(habitat_id);

  CREATE TABLE surveys (
    id INTEGER PRIMARY KEY,
    zoo_id INTEGER NOT NULL REFERENCES zoos(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    allow_suggestions INTEGER NOT NULL DEFAULT 1,
    is_open INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX surveys_zoo ON surveys(zoo_id);

  CREATE TABLE survey_options (
    id INTEGER PRIMARY KEY,
    survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    suggested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX survey_options_survey ON survey_options(survey_id);

  CREATE TABLE survey_votes (
    survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_id INTEGER NOT NULL REFERENCES survey_options(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    PRIMARY KEY (survey_id, user_id)
  );
  CREATE INDEX survey_votes_option ON survey_votes(option_id);

  CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    zoo_id INTEGER NOT NULL REFERENCES zoos(id) ON DELETE CASCADE,
    habitat_id INTEGER REFERENCES habitats(id) ON DELETE CASCADE,
    survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX events_actor ON events(actor_id, id);
  CREATE INDEX events_zoo ON events(zoo_id);
  `,
  // v2: theme parks (Planet Coaster) next to zoos.
  `
  ALTER TABLE zoos ADD COLUMN park_type TEXT NOT NULL DEFAULT 'zoo' CHECK (park_type IN ('zoo', 'theme_park'));
  `,
];

export function openDb(file: string): DB {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

function migrate(db: DB) {
  const { user_version: current } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let version = current; version < MIGRATIONS.length; version++) {
    tx(db, () => {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

/** Run fn inside a transaction, rolling back if it throws. */
export function tx<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const statements = new WeakMap<DB, Map<string, StatementSync>>();

function statement(db: DB, sql: string): StatementSync {
  let cache = statements.get(db);
  if (!cache) statements.set(db, (cache = new Map()));
  let stmt = cache.get(sql);
  if (!stmt) cache.set(sql, (stmt = db.prepare(sql)));
  return stmt;
}

export function one<T>(db: DB, sql: string, ...params: Param[]): T | undefined {
  return statement(db, sql).get(...params) as T | undefined;
}

export function all<T>(db: DB, sql: string, ...params: Param[]): T[] {
  return statement(db, sql).all(...params) as T[];
}

export function run(db: DB, sql: string, ...params: Param[]) {
  const result = statement(db, sql).run(...params);
  return { changes: Number(result.changes), id: Number(result.lastInsertRowid) };
}

/** Builds "?, ?, ?" for an IN (...) clause. */
export function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}
