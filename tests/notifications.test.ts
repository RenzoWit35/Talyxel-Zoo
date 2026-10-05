import { beforeEach, describe, expect, it } from 'vitest';
import type { Comment, FeedItem, FeedPage, NotificationsPage, ZooDetail } from '../shared/types';
import { makeApp, signUp, square, type TestApp } from './helpers';

let app: TestApp;

beforeEach(() => {
  ({ app } = makeApp());
});

type Client = Awaited<ReturnType<typeof signUp>>;
const inbox = async (user: Client) => (await user.get('/api/notifications')).body as NotificationsPage;

describe('notifications', () => {
  it('tells you about new followers and forgets an unfollow', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    await kai.put('/api/users/rosa/follow');
    await kai.put('/api/users/rosa/follow'); // following twice doesn't notify twice

    const box = await inbox(rosa);
    expect(box.unread).toBe(1);
    expect(box.items).toHaveLength(1);
    expect(box.items[0]).toMatchObject({ type: 'follow', read: false, actor: { username: 'kai' }, link: '/u/kai' });

    await kai.del('/api/users/rosa/follow');
    expect(await inbox(rosa)).toEqual({ items: [], unread: 0 });
  });

  it('notifies likes and comments on your posts, but not your own', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    const item = (await rosa.post('/api/posts', { kind: 'question', body: 'Bears or wolves for the forest?' })).body as FeedItem;

    await rosa.put(`/api/activity/${item.id}/like`);
    await rosa.post(`/api/activity/${item.id}/comments`, { body: 'Leaning bears' });
    expect((await inbox(rosa)).items).toHaveLength(0);

    await kai.put(`/api/activity/${item.id}/like`);
    const comment = (await kai.post(`/api/activity/${item.id}/comments`, { body: 'Wolves, definitely — with a den' })).body as Comment;
    const box = await inbox(rosa);
    expect(box.unread).toBe(2);
    expect(box.items.map((n) => n.type)).toEqual(['comment', 'like']);
    expect(box.items[0]).toMatchObject({ about: 'question', link: `/p/${item.id}`, comment: 'Wolves, definitely — with a den', target: 'Bears or wolves for the forest?' });

    await kai.del(`/api/activity/${item.id}/like`);
    await kai.del(`/api/comments/${comment.id}`);
    expect((await inbox(rosa)).items).toHaveLength(0);
  });

  it('notifies survey suggestions and marks everything read', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    const zoo = (await rosa.post('/api/zoos', { title: 'Savanna', width: 100, height: 100 })).body as ZooDetail;
    const published = (await rosa.post(`/api/zoos/${zoo.id}/publish`, { survey: { question: 'What next?', options: ['Bears', 'Wolves'] } })).body as ZooDetail;
    await kai.post(`/api/surveys/${published.surveys[0].id}/options`, { label: 'Snow leopards' });
    await rosa.post(`/api/surveys/${published.surveys[0].id}/options`, { label: 'Otters' }); // the owner adding one is no news

    const box = await inbox(rosa);
    expect(box.items).toHaveLength(1);
    expect(box.items[0]).toMatchObject({ type: 'suggestion', comment: 'Snow leopards', target: 'What next?', link: `/z/${zoo.id}#surveys` });

    expect((await rosa.post('/api/notifications/read')).body).toEqual({ unread: 0 });
    const after = await inbox(rosa);
    expect(after.unread).toBe(0);
    expect(after.items[0].read).toBe(true);
  });

  it('hides notifications about parks that went back to draft', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    const zoo = (await rosa.post('/api/zoos', { title: 'Savanna', width: 100, height: 100 })).body as ZooDetail;
    await rosa.post(`/api/zoos/${zoo.id}/publish`);
    await rosa.post(`/api/zoos/${zoo.id}/habitats`, { name: 'Lions', points: square(10, 10, 20) });
    const items = ((await rosa.get('/api/feed')).body as FeedPage).items;
    await kai.put(`/api/activity/${items[0].id}/like`);
    expect((await inbox(rosa)).items).toMatchObject([{ type: 'like', about: 'shape', target: 'Lions' }]);

    await rosa.post(`/api/zoos/${zoo.id}/unpublish`);
    expect(await inbox(rosa)).toEqual({ items: [], unread: 0 });
  });
});
