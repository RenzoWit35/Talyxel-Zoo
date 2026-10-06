import type { Biome, HabitatKind, HabitatStatus, ParkType } from '../shared/constants';
import type { Point } from '../shared/geometry';
import type { Habitat, ParkStats, Photo, StatsCustomRow, Survey, UserListItem, UserSummary, ZooDetail, ZooStatus, ZooSummary } from '../shared/types';
import { all, one, placeholders, type DB } from './db';

// ---------- users ----------

export interface UserRow {
  id: number;
  username: string;
  display_name: string;
  avatar_color: string;
  bio: string;
  created_at: string;
}

export const toUserSummary = (u: Pick<UserRow, 'id' | 'username' | 'display_name' | 'avatar_color'>): UserSummary => ({
  id: u.id,
  username: u.username,
  displayName: u.display_name,
  avatarColor: u.avatar_color,
});

/** Selects users with follower / zoo counts and the viewer's relationship to them. */
export function userListSql(where: string, orderAndLimit: string) {
  return `
    SELECT u.id, u.username, u.display_name, u.avatar_color, u.bio, u.created_at,
      (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) AS followers,
      (SELECT COUNT(*) FROM zoos z WHERE z.owner_id = u.id AND z.status = 'published') AS published_zoos,
      EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $viewer AND f.followee_id = u.id) AS is_following,
      EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.followee_id = $viewer) AS follows_you
    FROM users u
    WHERE ${where}
    ${orderAndLimit}`;
}

interface UserListRow extends UserRow {
  followers: number;
  published_zoos: number;
  is_following: number;
  follows_you: number;
}

export function listUsers(db: DB, where: string, orderAndLimit: string, params: Record<string, string | number>): UserListItem[] {
  const rows = db.prepare(userListSql(where, orderAndLimit)).all(params) as unknown as UserListRow[];
  return rows.map((r) => ({
    ...toUserSummary(r),
    bio: r.bio,
    followers: r.followers,
    publishedZoos: r.published_zoos,
    isFollowing: !!r.is_following,
    followsYou: !!r.follows_you,
  }));
}

// ---------- zoos ----------

export interface ZooRow {
  id: number;
  owner_id: number;
  title: string;
  description: string;
  width: number;
  height: number;
  background_url: string | null;
  background_opacity: number;
  status: ZooStatus;
  park_type: ParkType;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  owner_username: string;
  owner_display_name: string;
  owner_avatar_color: string;
}

export const ZOO_SELECT = `
  SELECT z.*, u.username AS owner_username, u.display_name AS owner_display_name, u.avatar_color AS owner_avatar_color
  FROM zoos z JOIN users u ON u.id = z.owner_id`;

const zooOwner = (z: ZooRow): UserSummary => ({
  id: z.owner_id,
  username: z.owner_username,
  displayName: z.owner_display_name,
  avatarColor: z.owner_avatar_color,
});

export function getZooRow(db: DB, id: number): ZooRow | undefined {
  return one<ZooRow>(db, `${ZOO_SELECT} WHERE z.id = ?`, id);
}

/** Viewer may see a zoo when they own it or it is published. */
export function canView(zoo: ZooRow, viewerId: number | undefined) {
  return zoo.status === 'published' || zoo.owner_id === viewerId;
}

export function loadZooSummaries(db: DB, zoos: ZooRow[]): ZooSummary[] {
  if (!zoos.length) return [];
  const ids = zoos.map((z) => z.id);
  const habitats = all<{ id: number; zoo_id: number; points: string; color: string; kind: HabitatKind; status: HabitatStatus }>(
    db,
    `SELECT id, zoo_id, points, color, kind, status FROM habitats WHERE zoo_id IN (${placeholders(ids.length)}) ORDER BY id`,
    ...ids,
  );
  const photos = all<{ zoo_id: number; count: number; cover: string | null }>(
    db,
    `SELECT h.zoo_id, COUNT(p.id) AS count, MIN(p.id) AS first_id,
       (SELECT p2.url FROM photos p2 JOIN habitats h2 ON h2.id = p2.habitat_id WHERE h2.zoo_id = h.zoo_id ORDER BY p2.id LIMIT 1) AS cover
     FROM photos p JOIN habitats h ON h.id = p.habitat_id
     WHERE h.zoo_id IN (${placeholders(ids.length)}) GROUP BY h.zoo_id`,
    ...ids,
  );
  const openSurveys = all<{ zoo_id: number }>(
    db,
    `SELECT DISTINCT zoo_id FROM surveys WHERE is_open = 1 AND zoo_id IN (${placeholders(ids.length)})`,
    ...ids,
  );
  const open = new Set(openSurveys.map((s) => s.zoo_id));
  const latestStats = all<{ zoo_id: number; data: string }>(
    db,
    `SELECT zoo_id, data FROM zoo_stats WHERE id IN
       (SELECT MAX(id) FROM zoo_stats WHERE zoo_id IN (${placeholders(ids.length)}) GROUP BY zoo_id)`,
    ...ids,
  );
  const guestsByZoo = new Map(latestStats.map((s) => [s.zoo_id, (JSON.parse(s.data) as StatsData).values.guests ?? null]));
  const photoByZoo = new Map(photos.map((p) => [p.zoo_id, p]));
  return zoos.map((z) => {
    const own = habitats.filter((h) => h.zoo_id === z.id);
    return {
      id: z.id,
      parkType: z.park_type,
      title: z.title,
      description: z.description,
      status: z.status,
      width: z.width,
      height: z.height,
      publishedAt: z.published_at,
      updatedAt: z.updated_at,
      owner: zooOwner(z),
      habitatCount: own.length,
      doneCount: own.filter((h) => h.status === 'done').length,
      photoCount: photoByZoo.get(z.id)?.count ?? 0,
      coverUrl: photoByZoo.get(z.id)?.cover ?? null,
      hasOpenSurvey: open.has(z.id),
      shapes: own.map((h) => ({ points: JSON.parse(h.points) as Point[], color: h.color, kind: h.kind })),
      guests: guestsByZoo.get(z.id) ?? null,
    };
  });
}

// ---------- in-game stats ----------

export interface StatsData {
  values: Record<string, number>;
  custom: StatsCustomRow[];
  gameDate: string;
}

/** The latest stats snapshot, plus the values of the one before it (an earlier day) to show change. */
export function loadStats(db: DB, zooId: number): ParkStats | null {
  const [latest, previous] = all<{ data: string; updated_at: string }>(
    db,
    'SELECT data, updated_at FROM zoo_stats WHERE zoo_id = ? ORDER BY id DESC LIMIT 2',
    zooId,
  );
  if (!latest) return null;
  const data = JSON.parse(latest.data) as StatsData;
  return {
    values: data.values,
    custom: data.custom,
    gameDate: data.gameDate,
    updatedAt: latest.updated_at,
    previous: previous ? (JSON.parse(previous.data) as StatsData).values : null,
    previousAt: previous?.updated_at ?? null,
  };
}

// ---------- habitats & photos ----------

export interface HabitatRow {
  id: number;
  zoo_id: number;
  name: string;
  kind: HabitatKind;
  status: HabitatStatus;
  biome: Biome;
  species: string;
  description: string;
  reason: string;
  color: string;
  points: string;
  position: number;
  created_at: string;
  updated_at: string;
}

interface PhotoRow {
  id: number;
  habitat_id: number;
  url: string;
  caption: string;
  created_at: string;
}

const toPhoto = (p: PhotoRow): Photo => ({ id: p.id, url: p.url, caption: p.caption, createdAt: p.created_at });

export function loadPhotos(db: DB, habitatIds: number[]): Map<number, Photo[]> {
  const byHabitat = new Map<number, Photo[]>();
  if (!habitatIds.length) return byHabitat;
  const rows = all<PhotoRow>(
    db,
    `SELECT * FROM photos WHERE habitat_id IN (${placeholders(habitatIds.length)}) ORDER BY id`,
    ...habitatIds,
  );
  for (const row of rows) {
    const list = byHabitat.get(row.habitat_id) ?? [];
    list.push(toPhoto(row));
    byHabitat.set(row.habitat_id, list);
  }
  return byHabitat;
}

export function toHabitat(row: HabitatRow, photos: Photo[]): Habitat {
  return {
    id: row.id,
    zooId: row.zoo_id,
    name: row.name,
    kind: row.kind,
    status: row.status,
    biome: row.biome,
    species: row.species,
    description: row.description,
    reason: row.reason,
    color: row.color,
    points: JSON.parse(row.points) as Point[],
    position: row.position,
    photos,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function loadHabitat(db: DB, id: number): Habitat | undefined {
  const row = one<HabitatRow>(db, 'SELECT * FROM habitats WHERE id = ?', id);
  if (!row) return undefined;
  return toHabitat(row, loadPhotos(db, [id]).get(id) ?? []);
}

/** Habitat plus the zoo it belongs to — used for permission checks. */
export function getHabitatWithZoo(db: DB, id: number) {
  const habitat = one<HabitatRow>(db, 'SELECT * FROM habitats WHERE id = ?', id);
  if (!habitat) return undefined;
  const zoo = getZooRow(db, habitat.zoo_id)!;
  return { habitat, zoo };
}

// ---------- surveys ----------

interface SurveyRow {
  id: number;
  zoo_id: number;
  question: string;
  allow_suggestions: number;
  is_open: number;
  created_at: string;
}

interface OptionRow {
  id: number;
  survey_id: number;
  label: string;
  suggested_by: number | null;
  sb_username: string | null;
  sb_display_name: string | null;
  sb_avatar_color: string | null;
  votes: number;
}

export function loadSurveys(db: DB, zoo: ZooRow, viewerId: number | undefined, surveyId?: number): Survey[] {
  const surveys = surveyId
    ? all<SurveyRow>(db, 'SELECT * FROM surveys WHERE id = ? AND zoo_id = ?', surveyId, zoo.id)
    : all<SurveyRow>(db, 'SELECT * FROM surveys WHERE zoo_id = ? ORDER BY is_open DESC, id DESC', zoo.id);
  if (!surveys.length) return [];
  const ids = surveys.map((s) => s.id);
  const options = all<OptionRow>(
    db,
    `SELECT o.id, o.survey_id, o.label, o.suggested_by,
       u.username AS sb_username, u.display_name AS sb_display_name, u.avatar_color AS sb_avatar_color,
       (SELECT COUNT(*) FROM survey_votes v WHERE v.option_id = o.id) AS votes
     FROM survey_options o LEFT JOIN users u ON u.id = o.suggested_by
     WHERE o.survey_id IN (${placeholders(ids.length)}) ORDER BY o.id`,
    ...ids,
  );
  const myVotes = viewerId
    ? all<{ survey_id: number; option_id: number }>(
        db,
        `SELECT survey_id, option_id FROM survey_votes WHERE user_id = ? AND survey_id IN (${placeholders(ids.length)})`,
        viewerId,
        ...ids,
      )
    : [];
  const myVoteBySurvey = new Map(myVotes.map((v) => [v.survey_id, v.option_id]));
  const isOwner = viewerId === zoo.owner_id;

  return surveys.map((s) => {
    const own = options.filter((o) => o.survey_id === s.id);
    const myVote = myVoteBySurvey.get(s.id) ?? null;
    // Hide the tally from logged-in visitors until they vote, so early results don't sway them.
    const resultsVisible = isOwner || myVote !== null || !s.is_open || !viewerId;
    return {
      id: s.id,
      zooId: s.zoo_id,
      question: s.question,
      allowSuggestions: !!s.allow_suggestions,
      isOpen: !!s.is_open,
      createdAt: s.created_at,
      totalVotes: own.reduce((sum, o) => sum + o.votes, 0),
      myVoteOptionId: myVote,
      resultsVisible,
      options: own.map((o) => ({
        id: o.id,
        label: o.label,
        votes: resultsVisible ? o.votes : null,
        suggestedBy:
          o.suggested_by && o.sb_username
            ? { id: o.suggested_by, username: o.sb_username, displayName: o.sb_display_name!, avatarColor: o.sb_avatar_color! }
            : null,
      })),
    };
  });
}

export function loadZooDetail(db: DB, zoo: ZooRow, viewerId: number | undefined): ZooDetail {
  const habitatRows = all<HabitatRow>(db, 'SELECT * FROM habitats WHERE zoo_id = ? ORDER BY position, id', zoo.id);
  const photos = loadPhotos(
    db,
    habitatRows.map((h) => h.id),
  );
  return {
    id: zoo.id,
    parkType: zoo.park_type,
    title: zoo.title,
    description: zoo.description,
    status: zoo.status,
    width: zoo.width,
    height: zoo.height,
    backgroundUrl: zoo.background_url,
    backgroundOpacity: zoo.background_opacity,
    publishedAt: zoo.published_at,
    createdAt: zoo.created_at,
    updatedAt: zoo.updated_at,
    owner: zooOwner(zoo),
    isOwner: viewerId === zoo.owner_id,
    habitats: habitatRows.map((h) => toHabitat(h, photos.get(h.id) ?? [])),
    surveys: loadSurveys(db, zoo, viewerId),
    stats: loadStats(db, zoo.id),
  };
}

export function touchZoo(db: DB, zooId: number) {
  db.prepare("UPDATE zoos SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(zooId);
}
