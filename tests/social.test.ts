import { existsSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Comment, FeedItem, FeedPage, Habitat, ZooDetail } from '../shared/types';
import { makeApp, PNG_1PX, signUp, square, type TestApp } from './helpers';

let app: TestApp;
let uploadDir: string;

beforeEach(() => {
  ({ app, uploadDir } = makeApp());
});

type Client = Awaited<ReturnType<typeof signUp>>;

/** Multipart post with photos. */
function postWithPhotos(user: Client, fields: Record<string, string>, photos: number) {
  let req = user.agent.post('/api/posts').set('x-talyxel', '1');
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  for (let i = 0; i < photos; i++) req = req.attach('photos', PNG_1PX, { filename: `p${i}.png`, contentType: 'image/png' });
  return req;
}

const feedOf = async (user: Client) => ((await user.get('/api/feed')).body as FeedPage).items;

async function publishedPark(owner: Client, title = 'Savanna Park') {
  const zoo = (await owner.post('/api/zoos', { title, width: 200, height: 100 })).body as ZooDetail;
  await owner.post(`/api/zoos/${zoo.id}/publish`);
  return zoo;
}

describe('posts', () => {
  it('shares updates with photos and questions without, and shows them to followers', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    await kai.put('/api/users/rosa/follow');

    const update = await postWithPhotos(rosa, { kind: 'update', body: 'New lion habitat finished!' }, 2);
    expect(update.status).toBe(201);
    const item = update.body as FeedItem;
    expect(item).toMatchObject({ type: 'post_created', likes: 0, liked: false, commentCount: 0, canDelete: true, zoo: null });
    expect(item.post).toMatchObject({ kind: 'update', body: 'New lion habitat finished!' });
    expect(item.post!.photos).toHaveLength(2);
    expect(existsSync(path.join(uploadDir, path.basename(item.post!.photos[0].url)))).toBe(true);

    const question = await rosa.post('/api/posts', { kind: 'question', body: 'Which coaster should I build next?' });
    expect(question.status).toBe(201);

    const items = await feedOf(kai);
    expect(items.map((i) => i.post?.kind)).toEqual(['question', 'update']);
    expect(items[1].canDelete).toBe(false);
  });

  it('validates posts', async () => {
    const rosa = await signUp(app, 'rosa');
    expect((await rosa.post('/api/posts', { kind: 'update', body: '   ' })).status).toBe(400);
    expect((await rosa.post('/api/posts', { kind: 'question', body: 'Hi' })).status).toBe(400);
    expect((await rosa.post('/api/posts', { kind: 'poll', body: 'Hello there' })).status).toBe(400);
    expect((await postWithPhotos(rosa, { kind: 'update' }, 11)).status).toBe(400);
    const flood = await postWithPhotos(rosa, { kind: 'update' }, 13);
    expect(flood.status).toBe(400);
    expect(flood.body.error).toBe('Too many files at once');
    const photoOnly = await postWithPhotos(rosa, { kind: 'update' }, 1);
    expect(photoOnly.status).toBe(201);
    expect((await request(app).post('/api/posts').set('x-talyxel', '1').send({ kind: 'update', body: 'x' })).status).toBe(401);
  });

  it('links a published park and hides it again when the park goes back to draft', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    await kai.put('/api/users/rosa/follow');
    const park = await publishedPark(rosa);
    const draft = (await rosa.post('/api/zoos', { title: 'Secret plan', width: 100, height: 100 })).body as ZooDetail;
    const kaisPark = await publishedPark(kai, 'Kai Park');

    expect((await rosa.post('/api/posts', { kind: 'update', body: 'Look', zooId: draft.id })).status).toBe(400);
    expect((await rosa.post('/api/posts', { kind: 'update', body: 'Look', zooId: kaisPark.id })).status).toBe(400);
    const linked = (await rosa.post('/api/posts', { kind: 'update', body: 'Look at my park', zooId: park.id })).body as FeedItem;
    expect(linked.zoo?.title).toBe('Savanna Park');

    await rosa.post(`/api/zoos/${park.id}/unpublish`);
    const seen = (await feedOf(kai)).find((i) => i.type === 'post_created')!;
    expect(seen.post?.body).toBe('Look at my park');
    expect(seen.zoo).toBeNull();
    expect(((await kai.get(`/api/activity/${linked.id}`)).body as FeedItem).zoo).toBeNull();
  });

  it('deletes your own posts and their photos, and nobody else’s', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    const item = (await postWithPhotos(rosa, { kind: 'update', body: 'Bye soon' }, 1)).body as FeedItem;
    const file = path.join(uploadDir, path.basename(item.post!.photos[0].url));

    expect((await kai.del(`/api/activity/${item.id}`)).status).toBe(403);
    expect((await rosa.del(`/api/activity/${item.id}`)).status).toBe(200);
    expect((await rosa.get(`/api/activity/${item.id}`)).status).toBe(404);
    await new Promise((r) => setTimeout(r, 20));
    expect(existsSync(file)).toBe(false);

    const park = await publishedPark(rosa);
    const published = (await feedOf(rosa)).find((i) => i.type === 'zoo_published' && i.zoo?.id === park.id)!;
    expect((await rosa.del(`/api/activity/${published.id}`)).status).toBe(400);
  });

  it('counts posts and published parks on profiles', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    await rosa.post('/api/posts', { kind: 'update', body: 'One' });
    await rosa.post('/api/posts', { kind: 'question', body: 'Two?' });
    await publishedPark(rosa);
    await rosa.post('/api/zoos', { title: 'Draft', width: 100, height: 100 });

    const seenByKai = (await kai.get('/api/users/rosa')).body;
    expect(seenByKai).toMatchObject({ postCount: 2 });
    expect(seenByKai.zoos).toHaveLength(1);
    expect((await rosa.get('/api/users/rosa')).body.zoos).toHaveLength(2); // you see your own drafts
  });

  it('lists a builder’s posts newest first and serves single posts to anyone', async () => {
    const rosa = await signUp(app, 'rosa');
    await rosa.post('/api/posts', { kind: 'update', body: 'First' });
    await publishedPark(rosa);
    const second = (await rosa.post('/api/posts', { kind: 'question', body: 'Second?' })).body as FeedItem;
    const posts = (await rosa.get('/api/users/rosa/posts')).body as FeedItem[];
    expect(posts.map((p) => p.post?.body)).toEqual(['Second?', 'First']);
    const anon = await request(app).get(`/api/activity/${second.id}`);
    expect(anon.status).toBe(200);
    expect(anon.body).toMatchObject({ liked: false, canDelete: false });
  });
});

describe('likes and comments', () => {
  it('likes and unlikes once per person', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    await kai.put('/api/users/rosa/follow');
    const item = (await rosa.post('/api/posts', { kind: 'update', body: 'Like me' })).body as FeedItem;

    expect((await kai.put(`/api/activity/${item.id}/like`)).body).toEqual({ likes: 1, liked: true });
    expect((await kai.put(`/api/activity/${item.id}/like`)).body).toEqual({ likes: 1, liked: true });
    expect((await rosa.put(`/api/activity/${item.id}/like`)).body).toEqual({ likes: 2, liked: true });

    const seen = (await feedOf(kai))[0];
    expect(seen).toMatchObject({ likes: 2, liked: true });
    expect(seen.likedBy.map((u) => u.username).sort()).toEqual(['kai', 'rosa']);

    expect((await kai.del(`/api/activity/${item.id}/like`)).body).toEqual({ likes: 1, liked: false });
    expect((await request(app).put(`/api/activity/${item.id}/like`).set('x-talyxel', '1')).status).toBe(401);
  });

  it('comments, previews the latest two and lets the right people delete', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    const moss = await signUp(app, 'moss');
    await kai.put('/api/users/rosa/follow');
    const item = (await rosa.post('/api/posts', { kind: 'question', body: 'Bears or wolves?' })).body as FeedItem;

    expect((await kai.post(`/api/activity/${item.id}/comments`, { body: '  ' })).status).toBe(400);
    const a = (await kai.post(`/api/activity/${item.id}/comments`, { body: 'Bears!' })).body as Comment;
    expect(a).toMatchObject({ body: 'Bears!', canDelete: true, author: { username: 'kai' } });
    await moss.post(`/api/activity/${item.id}/comments`, { body: 'Wolves' });
    await rosa.post(`/api/activity/${item.id}/comments`, { body: 'Thanks both' });

    const seen = (await feedOf(kai))[0];
    expect(seen.commentCount).toBe(3);
    expect(seen.comments.map((c) => c.body)).toEqual(['Wolves', 'Thanks both']);
    const all = (await kai.get(`/api/activity/${item.id}/comments`)).body as Comment[];
    expect(all.map((c) => c.body)).toEqual(['Bears!', 'Wolves', 'Thanks both']);
    expect(((await kai.get(`/api/activity/${item.id}`)).body as FeedItem).comments).toHaveLength(3);

    expect((await moss.del(`/api/comments/${a.id}`)).status).toBe(403);
    const mossComment = all[1];
    expect((await rosa.del(`/api/comments/${mossComment.id}`)).status).toBe(200); // the post's owner can tidy up
    expect((await kai.del(`/api/comments/${a.id}`)).status).toBe(200);
    expect(((await kai.get(`/api/activity/${item.id}/comments`)).body as Comment[]).map((c) => c.body)).toEqual(['Thanks both']);
  });

  it('only allows reactions on activity from published parks', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    const park = await publishedPark(rosa);
    const published = (await feedOf(rosa)).find((i) => i.type === 'zoo_published')!;
    expect((await kai.put(`/api/activity/${published.id}/like`)).status).toBe(200);

    await rosa.post(`/api/zoos/${park.id}/unpublish`);
    expect((await kai.put(`/api/activity/${published.id}/like`)).status).toBe(404);
    expect((await kai.post(`/api/activity/${published.id}/comments`, { body: 'Hello' })).status).toBe(404);
    expect((await kai.get(`/api/activity/${published.id}`)).status).toBe(404);
  });

  it('keeps likes and comments when photo uploads are merged into one feed entry', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    const park = await publishedPark(rosa);
    const habitat = (await rosa.post(`/api/zoos/${park.id}/habitats`, { name: 'Lions', points: square(10, 10, 30) })).body as Habitat;
    const upload = () =>
      rosa.agent.post(`/api/habitats/${habitat.id}/photos`).set('x-talyxel', '1').attach('photos', PNG_1PX, { filename: 'a.png', contentType: 'image/png' });

    await upload();
    const first = (await feedOf(rosa)).find((i) => i.type === 'photos_added')!;
    await kai.put(`/api/activity/${first.id}/like`);
    await kai.post(`/api/activity/${first.id}/comments`, { body: 'Gorgeous' });

    await upload();
    const merged = (await feedOf(rosa)).filter((i) => i.type === 'photos_added');
    expect(merged).toHaveLength(1);
    expect(merged[0].id).not.toBe(first.id);
    expect(merged[0]).toMatchObject({ likes: 1, commentCount: 1 });
    expect(merged[0].photos).toHaveLength(2);
  });
});
