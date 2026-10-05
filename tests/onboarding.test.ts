import { beforeEach, describe, expect, it } from 'vitest';
import type { Onboarding, ZooDetail } from '../shared/types';
import { makeApp, signUp, square, type TestApp } from './helpers';

let app: TestApp;

beforeEach(() => {
  ({ app } = makeApp());
});

describe('getting-started checklist', () => {
  it('ticks steps off as a new builder uses the site', async () => {
    const rosa = await signUp(app, 'rosa');
    await signUp(app, 'kai');
    const progress = async () => (await rosa.get('/api/onboarding')).body as Onboarding;

    expect(await progress()).toEqual({
      steps: { park: false, shape: false, mapDetails: false, stats: false, publish: false, follow: false, post: false, profile: false },
      dismissed: false,
      parkId: null,
    });

    const zoo = (await rosa.post('/api/zoos', { title: 'First zoo', width: 100, height: 100 })).body as ZooDetail;
    await rosa.post(`/api/zoos/${zoo.id}/habitats`, { name: 'Lions', points: square(10, 10, 20) });
    await rosa.post(`/api/zoos/${zoo.id}/habitats`, { kind: 'route', points: [[0, 50], [90, 50]] });
    await rosa.put(`/api/zoos/${zoo.id}/stats`, { values: { guests: 10 }, custom: [], gameDate: '' });
    await rosa.post(`/api/zoos/${zoo.id}/publish`);
    await rosa.put('/api/users/kai/follow');
    await rosa.post('/api/posts', { kind: 'update', body: 'Hello!' });
    await rosa.patch('/api/auth/me', { bio: 'Lion fan' });

    const done = await progress();
    expect(Object.values(done.steps).every(Boolean)).toBe(true);
    expect(done.parkId).toBe(zoo.id);
  });

  it('can be hidden and shown again', async () => {
    const rosa = await signUp(app, 'rosa');
    expect((await rosa.put('/api/onboarding', { dismissed: true })).body.dismissed).toBe(true);
    expect(((await rosa.get('/api/onboarding')).body as Onboarding).dismissed).toBe(true);
    expect((await rosa.put('/api/onboarding', { dismissed: false })).body.dismissed).toBe(false);
  });
});
