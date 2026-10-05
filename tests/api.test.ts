import { existsSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { FeedPage, Habitat, Survey, ZooDetail } from '../shared/types';
import { makeApp, PNG_1PX, signUp, square, type TestApp } from './helpers';

let app: TestApp;
let uploadDir: string;

beforeEach(() => {
  ({ app, uploadDir } = makeApp());
});

async function zooWithHabitat(owner: Awaited<ReturnType<typeof signUp>>) {
  const zoo = (await owner.post('/api/zoos', { title: 'Savanna Park', width: 200, height: 100 })).body as ZooDetail;
  const habitat = (await owner.post(`/api/zoos/${zoo.id}/habitats`, { name: 'Lion Pride', species: 'West African Lion', points: square(10, 10, 30) }))
    .body as Habitat;
  return { zoo, habitat };
}

describe('auth', () => {
  it('registers, reports the session user, logs out and back in', async () => {
    const rosa = await signUp(app, 'rosa');
    expect((await rosa.get('/api/auth/me')).body).toMatchObject({ username: 'rosa', displayName: 'ROSA' });

    await rosa.post('/api/auth/logout');
    expect((await rosa.get('/api/auth/me')).body).toBeNull();

    const bad = await rosa.post('/api/auth/login', { username: 'rosa', password: 'wrong-password' });
    expect(bad.status).toBe(401);
    const good = await rosa.post('/api/auth/login', { username: 'ROSA', password: 'correct-horse' });
    expect(good.status).toBe(200);
    expect((await rosa.get('/api/auth/me')).body.username).toBe('rosa');
  });

  it('rejects duplicate usernames and weak passwords', async () => {
    await signUp(app, 'kai');
    const dup = await request(app).post('/api/auth/register').set('x-talyxel', '1').send({ username: 'Kai', password: 'long-enough' });
    expect(dup.status).toBe(409);
    const weak = await request(app).post('/api/auth/register').set('x-talyxel', '1').send({ username: 'moss', password: 'short' });
    expect(weak.status).toBe(400);
  });

  it('refuses state-changing requests without the CSRF header', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'eve', password: 'long-enough' });
    expect(res.status).toBe(403);
  });
});

describe('zoo planning', () => {
  it('creates a zoo, draws habitats, clamps them to the map and computes summaries', async () => {
    const rosa = await signUp(app, 'rosa');
    const { zoo, habitat } = await zooWithHabitat(rosa);
    expect(habitat).toMatchObject({ name: 'Lion Pride', kind: 'habitat', status: 'planned' });

    const off = await rosa.post(`/api/zoos/${zoo.id}/habitats`, { name: 'Edge', points: [[-5, -5], [250, 0], [250, 150]] });
    expect(off.body.points).toEqual([[0, 0], [200, 0], [200, 100]]);

    const patched = await rosa.patch(`/api/habitats/${habitat.id}`, { status: 'building', biome: 'grassland' });
    expect(patched.body).toMatchObject({ status: 'building', biome: 'grassland', name: 'Lion Pride' });

    const mine = await rosa.get('/api/zoos/mine');
    expect(mine.body[0]).toMatchObject({ title: 'Savanna Park', habitatCount: 2, status: 'draft' });
  });

  it('keeps drafts private and blocks edits by other users', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    const { zoo, habitat } = await zooWithHabitat(rosa);

    expect((await kai.get(`/api/zoos/${zoo.id}`)).status).toBe(404);
    expect((await request(app).get(`/api/zoos/${zoo.id}`)).status).toBe(404);

    await rosa.post(`/api/zoos/${zoo.id}/publish`);
    expect((await request(app).get(`/api/zoos/${zoo.id}`)).status).toBe(200);
    expect((await kai.patch(`/api/habitats/${habitat.id}`, { name: 'Mine now' })).status).toBe(403);
    expect((await kai.del(`/api/zoos/${zoo.id}`)).status).toBe(403);
  });

  it('refuses to shrink the map below existing shapes', async () => {
    const rosa = await signUp(app, 'rosa');
    const { zoo } = await zooWithHabitat(rosa);
    const res = await rosa.patch(`/api/zoos/${zoo.id}`, { width: 30 });
    expect(res.status).toBe(400);
    expect((await rosa.patch(`/api/zoos/${zoo.id}`, { width: 60 })).body.width).toBe(60);
  });

  it('reorders the board', async () => {
    const rosa = await signUp(app, 'rosa');
    const { zoo, habitat } = await zooWithHabitat(rosa);
    const second = (await rosa.post(`/api/zoos/${zoo.id}/habitats`, { name: 'Giraffes', points: square(50, 10, 20) })).body as Habitat;
    const res = await rosa.put(`/api/zoos/${zoo.id}/board`, { columns: { done: [second.id, habitat.id] } });
    expect(res.body.map((h: Habitat) => [h.name, h.status, h.position])).toEqual([
      ['Giraffes', 'done', 0],
      ['Lion Pride', 'done', 1],
    ]);
  });

  it('uploads photos, rejects non-images and deletes files with the habitat', async () => {
    const rosa = await signUp(app, 'rosa');
    const { habitat } = await zooWithHabitat(rosa);

    const fake = await rosa.agent
      .post(`/api/habitats/${habitat.id}/photos`)
      .set('x-talyxel', '1')
      .attach('photos', Buffer.from('<html>not an image</html>'), { filename: 'evil.png', contentType: 'image/png' });
    expect(fake.status).toBe(400);

    const ok = await rosa.agent
      .post(`/api/habitats/${habitat.id}/photos`)
      .set('x-talyxel', '1')
      .field('caption', 'Morning light')
      .attach('photos', PNG_1PX, { filename: 'lion.png', contentType: 'image/png' });
    expect(ok.status).toBe(201);
    const photo = (ok.body as Habitat).photos[0];
    expect(photo.caption).toBe('Morning light');
    const file = path.join(uploadDir, path.basename(photo.url));
    expect(existsSync(file)).toBe(true);
    expect((await request(app).get(photo.url)).status).toBe(200);

    const linked = await rosa.post(`/api/habitats/${habitat.id}/photos`, { url: 'https://example.com/lion.jpg' });
    expect(linked.body.photos).toHaveLength(2);
    expect((await rosa.post(`/api/habitats/${habitat.id}/photos`, { url: 'http://example.com/x.jpg' })).status).toBe(400);

    await rosa.del(`/api/habitats/${habitat.id}`);
    await new Promise((r) => setTimeout(r, 20));
    expect(existsSync(file)).toBe(false);
  });
});

describe('theme parks', () => {
  it('creates a theme park with coaster shapes and theme-park themes', async () => {
    const lotte = await signUp(app, 'lotte');
    const park = (await lotte.post('/api/zoos', { title: 'Thunder Peak', parkType: 'theme_park', width: 300, height: 200 })).body as ZooDetail;
    expect(park.parkType).toBe('theme_park');

    // Without a kind, new shapes default to the park type's main kind.
    const first = (await lotte.post(`/api/zoos/${park.id}/habitats`, { name: 'Thunderbolt', species: 'Wooden coaster', points: square(10, 10, 40) }))
      .body as Habitat;
    expect(first.kind).toBe('coaster');

    const ride = await lotte.post(`/api/zoos/${park.id}/habitats`, { name: 'Skywheel', kind: 'ride', biome: 'pirate', points: square(60, 10, 20) });
    expect(ride.status).toBe(201);
    expect(ride.body.biome).toBe('pirate');

    expect((await lotte.post(`/api/zoos/${park.id}/habitats`, { kind: 'habitat', points: square(90, 10, 20) })).status).toBe(400);
    expect((await lotte.post(`/api/zoos/${park.id}/habitats`, { kind: 'ride', biome: 'tropical', points: square(90, 10, 20) })).status).toBe(400);
    expect((await lotte.patch(`/api/habitats/${first.id}`, { kind: 'exhibit' })).status).toBe(400);
  });

  it('keeps zoo shapes out of theme parks and filters explore by type', async () => {
    const rosa = await signUp(app, 'rosa');
    const { zoo } = await zooWithHabitat(rosa);
    expect(zoo.parkType).toBe('zoo');
    expect((await rosa.post(`/api/zoos/${zoo.id}/habitats`, { kind: 'coaster', points: square(50, 50, 20) })).status).toBe(400);

    // A zoo with a habitat in it can't become a theme park…
    expect((await rosa.patch(`/api/zoos/${zoo.id}`, { parkType: 'theme_park' })).status).toBe(400);

    // …but one with only shared shape types can, and its biomes are cleared.
    const plain = (await rosa.post('/api/zoos', { title: 'Lakeside', width: 100, height: 100 })).body as ZooDetail;
    await rosa.post(`/api/zoos/${plain.id}/habitats`, { kind: 'water', biome: 'aquatic', points: square(10, 10, 20) });
    const switched = (await rosa.patch(`/api/zoos/${plain.id}`, { parkType: 'theme_park' })).body as ZooDetail;
    expect(switched.parkType).toBe('theme_park');
    expect(switched.habitats[0].biome).toBe('');

    await rosa.post(`/api/zoos/${zoo.id}/publish`);
    await rosa.post(`/api/zoos/${plain.id}/publish`);
    const titles = async (type: string) => ((await request(app).get(`/api/zoos/explore?type=${type}`)).body as ZooDetail[]).map((z) => z.title);
    expect(await titles('zoo')).toEqual(['Savanna Park']);
    expect(await titles('theme_park')).toEqual(['Lakeside']);
    expect(await titles('')).toHaveLength(2);
  });
});

describe('utilities, walk routes and areas of interest', () => {
  it('stores walk routes as open lines with at least two points', async () => {
    const rosa = await signUp(app, 'rosa');
    const { zoo } = await zooWithHabitat(rosa);
    const route = await rosa.post(`/api/zoos/${zoo.id}/habitats`, { name: 'Safari walk', kind: 'route', species: 'Guided tour', points: [[10, 50], [90, 50]] });
    expect(route.status).toBe(201);
    expect(route.body).toMatchObject({ kind: 'route', points: [[10, 50], [90, 50]], species: 'Guided tour' });

    expect((await rosa.post(`/api/zoos/${zoo.id}/habitats`, { kind: 'route', points: [[10, 50]] })).status).toBe(400);
    const twoCornerArea = await rosa.post(`/api/zoos/${zoo.id}/habitats`, { kind: 'habitat', points: [[10, 50], [90, 50]] });
    expect(twoCornerArea.status).toBe(400);
    expect(twoCornerArea.body.error).toMatch(/3 corners/);

    // Lines and areas don't turn into each other.
    expect((await rosa.patch(`/api/habitats/${route.body.id}`, { kind: 'habitat' })).status).toBe(400);
    expect((await rosa.patch(`/api/habitats/${route.body.id}`, { points: [[0, 0]] })).status).toBe(400);
    const bent = await rosa.patch(`/api/habitats/${route.body.id}`, { points: [[10, 50], [50, 80], [90, 50]] });
    expect(bent.body.points).toHaveLength(3);
  });

  it('allows utilities, routes and areas of interest in zoos and theme parks', async () => {
    const lotte = await signUp(app, 'lotte');
    for (const parkType of ['zoo', 'theme_park']) {
      const park = (await lotte.post('/api/zoos', { title: `Park ${parkType}`, parkType, width: 200, height: 100 })).body as ZooDetail;
      const utility = await lotte.post(`/api/zoos/${park.id}/habitats`, { kind: 'utility', species: 'Power substation', points: square(10, 10, 10) });
      const interest = await lotte.post(`/api/zoos/${park.id}/habitats`, { kind: 'interest', species: 'Viewpoint', points: square(30, 10, 10) });
      const route = await lotte.post(`/api/zoos/${park.id}/habitats`, { kind: 'route', points: [[0, 50], [100, 60]] });
      expect([utility.status, interest.status, route.status]).toEqual([201, 201, 201]);
    }
  });

  it('lets a park with only shared shapes switch type', async () => {
    const rosa = await signUp(app, 'rosa');
    const plain = (await rosa.post('/api/zoos', { title: 'Grounds', width: 100, height: 100 })).body as ZooDetail;
    await rosa.post(`/api/zoos/${plain.id}/habitats`, { kind: 'route', points: [[0, 0], [50, 50]] });
    await rosa.post(`/api/zoos/${plain.id}/habitats`, { kind: 'utility', points: square(60, 60, 10) });
    expect((await rosa.patch(`/api/zoos/${plain.id}`, { parkType: 'theme_park' })).status).toBe(200);
  });
});

describe('publishing with a survey', () => {
  it('hides results until you vote, accepts suggestions and lets the owner close it', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    const mo = await signUp(app, 'moss');
    const { zoo } = await zooWithHabitat(rosa);

    const published = await rosa.post(`/api/zoos/${zoo.id}/publish`, {
      survey: { question: 'What should I add next?', options: ['Red Panda', 'Aquarium'], allowSuggestions: true },
    });
    expect(published.body.status).toBe('published');
    const survey = (published.body as ZooDetail).surveys[0];
    expect(survey.options).toHaveLength(2);

    const before = ((await kai.get(`/api/zoos/${zoo.id}`)).body as ZooDetail).surveys[0];
    expect(before.resultsVisible).toBe(false);
    expect(before.options[0].votes).toBeNull();

    const voted = (await kai.post(`/api/surveys/${survey.id}/vote`, { optionId: survey.options[0].id })).body as Survey;
    expect(voted).toMatchObject({ resultsVisible: true, totalVotes: 1, myVoteOptionId: survey.options[0].id });

    const suggested = (await mo.post(`/api/surveys/${survey.id}/options`, { label: 'Snow Leopard' })).body as Survey;
    expect(suggested.options.map((o) => [o.label, o.votes, o.suggestedBy?.username ?? null])).toEqual([
      ['Red Panda', 1, null],
      ['Aquarium', 0, null],
      ['Snow Leopard', 1, 'moss'],
    ]);

    // Changing your vote moves it rather than adding a second one.
    const moved = (await kai.post(`/api/surveys/${survey.id}/vote`, { optionId: suggested.options[2].id })).body as Survey;
    expect(moved.totalVotes).toBe(2);
    expect(moved.options[2].votes).toBe(2);

    expect((await kai.patch(`/api/surveys/${survey.id}`, { isOpen: false })).status).toBe(403);
    await rosa.patch(`/api/surveys/${survey.id}`, { isOpen: false });
    expect((await mo.post(`/api/surveys/${survey.id}/vote`, { optionId: survey.options[1].id })).status).toBe(409);
  });

  it('validates survey options', async () => {
    const rosa = await signUp(app, 'rosa');
    const { zoo } = await zooWithHabitat(rosa);
    const res = await rosa.post(`/api/zoos/${zoo.id}/publish`, { survey: { question: 'Next?', options: ['Only one'] } });
    expect(res.status).toBe(400);
    const dupes = await rosa.post(`/api/zoos/${zoo.id}/publish`, { survey: { question: 'Next?', options: ['Bears', 'bears'] } });
    expect(dupes.status).toBe(400);
  });
});

describe('social', () => {
  it('follows, detects friends and shows suggestions', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    await signUp(app, 'moss');

    await rosa.put('/api/users/kai/follow');
    let profile = (await kai.get('/api/users/rosa')).body;
    expect(profile).toMatchObject({ followsYou: true, isFollowing: false });

    await kai.put('/api/users/rosa/follow');
    profile = (await kai.get('/api/users/rosa')).body;
    expect(profile).toMatchObject({ followsYou: true, isFollowing: true, followers: 1, following: 1 });

    expect((await rosa.put('/api/users/rosa/follow')).status).toBe(400);
    const suggestions = (await rosa.get('/api/users/suggestions')).body.map((u: { username: string }) => u.username);
    expect(suggestions).toEqual(['moss']);

    await rosa.del('/api/users/kai/follow');
    expect((await kai.get('/api/users/kai/followers')).body).toEqual([]);
  });

  it('builds a feed of followed users’ additions to published zoos only', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    await kai.put('/api/users/rosa/follow');

    const { zoo } = await zooWithHabitat(rosa);
    const feedOf = async () => ((await kai.get('/api/feed')).body as FeedPage).items;
    expect(await feedOf()).toEqual([]); // still a draft

    await rosa.post(`/api/zoos/${zoo.id}/publish`, { survey: { question: 'What next?', options: ['Bears', 'Wolves'] } });
    const elephants = (await rosa.post(`/api/zoos/${zoo.id}/habitats`, { name: 'Elephants', points: square(100, 10, 40) })).body as Habitat;
    await rosa.agent.post(`/api/habitats/${elephants.id}/photos`).set('x-talyxel', '1').attach('photos', PNG_1PX, { filename: 'a.png', contentType: 'image/png' });
    await rosa.agent.post(`/api/habitats/${elephants.id}/photos`).set('x-talyxel', '1').attach('photos', PNG_1PX, { filename: 'b.png', contentType: 'image/png' });

    const items = await feedOf();
    expect(items.map((i) => i.type)).toEqual(['photos_added', 'habitat_added', 'zoo_published']);
    expect(items[0].photos).toHaveLength(2); // both uploads merged into one entry
    expect(items[1].habitat?.name).toBe('Elephants');
    expect(items[2].survey).toMatchObject({ question: 'What next?', optionCount: 2 });
    expect(items[2].zoo?.shapes).toHaveLength(2);

    // Unpublishing hides everything from followers again.
    await rosa.post(`/api/zoos/${zoo.id}/unpublish`);
    expect(await feedOf()).toEqual([]);

    // A stranger's activity never shows up.
    const mo = await signUp(app, 'moss');
    const other = await zooWithHabitat(mo);
    await mo.post(`/api/zoos/${other.zoo.id}/publish`);
    expect(await feedOf()).toEqual([]);
  });

  it('paginates the feed', async () => {
    const rosa = await signUp(app, 'rosa');
    const { zoo } = await zooWithHabitat(rosa);
    await rosa.post(`/api/zoos/${zoo.id}/publish`);
    for (let i = 0; i < 24; i++) await rosa.post(`/api/zoos/${zoo.id}/habitats`, { name: `H${i}`, points: square(i * 5, 60, 4) });
    const first = (await rosa.get('/api/feed')).body as FeedPage;
    expect(first.items).toHaveLength(20);
    const second = (await rosa.get(`/api/feed?before=${first.nextCursor}`)).body as FeedPage;
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
  });
});
