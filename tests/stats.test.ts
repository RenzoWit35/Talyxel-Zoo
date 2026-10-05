import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../server/db';
import type { ParkStats, ZooDetail, ZooSummary } from '../shared/types';
import { makeApp, signUp, type TestApp } from './helpers';

let app: TestApp;
let db: DB;

beforeEach(() => {
  ({ app, db } = makeApp());
});

const empty = { custom: [], gameDate: '' };

describe('park statistics', () => {
  it('saves in-game stats, shows them on the park and the guests on cards', async () => {
    const rosa = await signUp(app, 'rosa');
    const zoo = (await rosa.post('/api/zoos', { title: 'Savanna', width: 100, height: 100 })).body as ZooDetail;
    expect(zoo.stats).toBeNull();

    const res = await rosa.put(`/api/zoos/${zoo.id}/stats`, {
      values: { guests: 1250, rating: 4.5, guestHappiness: 87.5, monthlyProfit: -1200, animals: null },
      custom: [{ label: 'Gift shop income', value: '$3,400 / month' }],
      gameDate: 'Year 3, March',
    });
    expect(res.status).toBe(200);
    const stats = res.body as ParkStats;
    expect(stats.values).toEqual({ guests: 1250, rating: 4.5, guestHappiness: 87.5, monthlyProfit: -1200 });
    expect(stats).toMatchObject({ gameDate: 'Year 3, March', previous: null, custom: [{ label: 'Gift shop income', value: '$3,400 / month' }] });

    const detail = (await rosa.get(`/api/zoos/${zoo.id}`)).body as ZooDetail;
    expect(detail.stats?.values.guests).toBe(1250);
    const mine = (await rosa.get('/api/zoos/mine')).body as ZooSummary[];
    expect(mine[0].guests).toBe(1250);
  });

  it('rejects stats that do not fit the park type or their range', async () => {
    const rosa = await signUp(app, 'rosa');
    const zoo = (await rosa.post('/api/zoos', { title: 'Savanna', width: 100, height: 100 })).body as ZooDetail;
    const put = (values: Record<string, number>, extra = {}) => rosa.put(`/api/zoos/${zoo.id}/stats`, { ...empty, values, ...extra });

    expect((await put({ rides: 4 })).status).toBe(400); // a theme park stat
    expect((await put({ guests: -5 })).status).toBe(400);
    const fraction = await put({ guests: 1.5 });
    expect(fraction.status).toBe(400);
    expect(fraction.body.error).toMatch(/Guests/);
    expect((await put({ guestHappiness: 120 })).status).toBe(400);
    expect((await put({ rating: 6 })).status).toBe(400);
    const rows = Array.from({ length: 13 }, (_, i) => ({ label: `Row ${i}`, value: String(i) }));
    expect((await put({}, { custom: rows })).status).toBe(400);
    expect((await put({}, { custom: [{ label: '', value: 'x' }] })).status).toBe(400);
    expect((await put({ cash: -50_000 })).status).toBe(200); // money can go negative

    const park = (await rosa.post('/api/zoos', { title: 'Coasters', parkType: 'theme_park', width: 100, height: 100 })).body as ZooDetail;
    expect((await rosa.put(`/api/zoos/${park.id}/stats`, { ...empty, values: { rides: 12, avgExcitement: 6.4 } })).status).toBe(200);
    expect((await rosa.put(`/api/zoos/${park.id}/stats`, { ...empty, values: { animals: 3 } })).status).toBe(400);
  });

  it('updates today’s snapshot and keeps an earlier day to show change', async () => {
    const rosa = await signUp(app, 'rosa');
    const zoo = (await rosa.post('/api/zoos', { title: 'Savanna', width: 100, height: 100 })).body as ZooDetail;
    const save = async (guests: number) => (await rosa.put(`/api/zoos/${zoo.id}/stats`, { ...empty, values: { guests } })).body as ParkStats;

    await save(100);
    const sameDay = await save(150);
    expect(sameDay.values.guests).toBe(150);
    expect(sameDay.previous).toBeNull();
    expect((db.prepare('SELECT COUNT(*) AS n FROM zoo_stats').get() as { n: number }).n).toBe(1);

    db.prepare("UPDATE zoo_stats SET created_at = '2020-01-01T10:00:00.000Z', updated_at = '2020-01-01T10:00:00.000Z'").run();
    const nextDay = await save(400);
    expect(nextDay.values.guests).toBe(400);
    expect(nextDay.previous).toEqual({ guests: 150 });
    expect(nextDay.previousAt).toBe('2020-01-01T10:00:00.000Z');
  });

  it('keeps draft stats private and only lets the owner change them', async () => {
    const rosa = await signUp(app, 'rosa');
    const kai = await signUp(app, 'kai');
    const zoo = (await rosa.post('/api/zoos', { title: 'Savanna', width: 100, height: 100 })).body as ZooDetail;
    await rosa.put(`/api/zoos/${zoo.id}/stats`, { ...empty, values: { guests: 10 } });

    expect((await kai.put(`/api/zoos/${zoo.id}/stats`, { ...empty, values: { guests: 99 } })).status).toBe(404);
    await rosa.post(`/api/zoos/${zoo.id}/publish`);
    expect((await kai.put(`/api/zoos/${zoo.id}/stats`, { ...empty, values: { guests: 99 } })).status).toBe(403);
    expect(((await kai.get(`/api/zoos/${zoo.id}`)).body as ZooDetail).stats?.values.guests).toBe(10);
  });
});
