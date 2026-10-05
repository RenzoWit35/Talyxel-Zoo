import { expect, test } from '@playwright/test';
import { paintPostcard } from '../server/seed-images';
import { addShape, apiUser, createPark } from './helpers';

test('profiles show counts, parks from above and a grid of posts', async ({ page, browser, baseURL }) => {
  const rosa = await apiUser(baseURL!, 'rosa', 'Rosa Verhoeven');
  const kai = await apiUser(baseURL!, 'kai', 'Kai Lindqvist');

  const park = await createPark(rosa, { title: 'Serengeti Crossroads', width: 400, height: 260 });
  await addShape(rosa, park.id, { name: 'Lion Hill', kind: 'habitat', points: [[20, 20], [180, 20], [170, 120], [30, 110]] });
  await addShape(rosa, park.id, { name: 'Power', kind: 'utility', points: [[300, 30], [370, 30], [370, 80], [300, 80]] });
  await addShape(rosa, park.id, { name: 'Safari walk', kind: 'route', points: [[10, 200], [200, 150], [390, 210]] });
  await rosa.api.post(`/api/zoos/${park.id}/publish`, { data: {} });
  await createPark(rosa, { title: 'Secret draft' });
  await rosa.api.post('/api/posts', {
    multipart: { kind: 'update', body: 'Golden hour at the lion hill', photos: { name: 'a.png', mimeType: 'image/png', buffer: paintPostcard('grassland', 5) } },
  });
  await rosa.api.post('/api/posts', { data: { kind: 'question', body: 'Night safari: yes or no?' } });

  // A visitor sees published parks only.
  await kai.loginPage(page);
  await page.goto(`/u/${rosa.username}`);
  await expect(page.getByRole('heading', { name: 'Rosa Verhoeven' })).toBeVisible();
  const counts = page.locator('.profile-counts');
  await expect(counts).toContainText('2 posts');
  await expect(counts).toContainText('1 park');
  const parks = page.locator('.park-map-card');
  await expect(parks).toHaveCount(1);
  await expect(parks.first()).toContainText('Serengeti Crossroads');
  await expect(parks.first()).toContainText('of walk routes');
  await expect(parks.first().locator('svg polyline').first()).toBeAttached();
  await expect(parks.first().locator('.park-map-legend')).toContainText('Walk route');

  const tiles = page.locator('.post-tile');
  await expect(tiles).toHaveCount(2);
  await page.screenshot({ path: `test-results/screens/profile-${test.info().project.name}.png`, fullPage: true });
  await tiles.last().click();
  await expect(page).toHaveURL(/\/p\/\d+$/);
  await expect(page.locator('.post-card')).toContainText('Golden hour at the lion hill');

  // The owner also sees their draft.
  const own = await browser.newPage();
  await rosa.loginPage(own);
  await own.goto(`/u/${rosa.username}`);
  await expect(own.locator('.park-map-card')).toHaveCount(2);
  await expect(own.locator('.park-map-card', { hasText: 'Secret draft' })).toContainText('Draft');
  await own.close();
});
