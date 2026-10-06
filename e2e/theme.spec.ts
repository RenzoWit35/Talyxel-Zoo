import { expect, test } from '@playwright/test';
import { paintPostcard } from '../server/seed-images';
import { addShape, apiUser, createPark } from './helpers';

type Page = import('@playwright/test').Page;
const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
/** The light/dark switch lives in the account menu. */
async function switchTheme(page: Page, to: 'light' | 'dark') {
  await page.getByRole('button', { name: 'Your account' }).click();
  await page.getByRole('menuitem', { name: `Switch to ${to} mode` }).click();
}

test('follows the system dark mode, and the toggle overrides and remembers it', async ({ page, baseURL }) => {
  const user = await apiUser(baseURL!, 'night', 'Night Owl');
  const park = await createPark(user, { title: 'Moonlight Zoo', width: 300, height: 200 });
  await addShape(user, park.id, { name: 'Wolf Woods', kind: 'habitat', species: 'Timber Wolf', points: [[20, 20], [140, 20], [140, 110], [20, 110]] });
  await addShape(user, park.id, { name: 'Night walk', kind: 'route', points: [[10, 150], [290, 140]] });
  await addShape(user, park.id, { name: 'Owl lookout', kind: 'interest', points: [[180, 30], [260, 30], [260, 100], [180, 100]] });
  await user.api.post(`/api/zoos/${park.id}/publish`, { data: {} });
  await user.api.put(`/api/zoos/${park.id}/stats`, { data: { values: { guests: 820, rating: 4 }, custom: [], gameDate: 'Year 1' } });
  await user.api.post('/api/posts', {
    multipart: { kind: 'update', body: 'The wolves got their night lights', zooId: String(park.id), photos: { name: 'w.png', mimeType: 'image/png', buffer: paintPostcard('taiga', 3) } },
  });
  await user.api.post('/api/posts', { data: { kind: 'question', body: 'Aurora theme for the whole zoo?' } });

  await page.emulateMedia({ colorScheme: 'dark' });
  await user.loginPage(page);
  await page.goto('/social');
  await expect(page.locator('.post-card').first()).toBeVisible();
  expect(await bodyBackground(page)).toBe('rgb(7, 24, 39)');
  const name = test.info().project.name;
  await page.screenshot({ path: `test-results/screens/dark-feed-${name}.png` });
  await page.goto(`/z/${park.id}`);
  await expect(page.locator('.shape')).toHaveCount(3);
  await page.screenshot({ path: `test-results/screens/dark-park-${name}.png`, fullPage: true });
  await page.goto(`/zoos/${park.id}/edit`);
  await expect(page.locator('.shape-palette')).toBeVisible();
  await page.screenshot({ path: `test-results/screens/dark-planner-${name}.png` });

  await switchTheme(page, 'light');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  await page.goto(`/u/${user.username}`);
  expect(await bodyBackground(page)).toBe('rgb(243, 241, 235)');
  await switchTheme(page, 'dark');
  await page.reload();
  expect(await bodyBackground(page)).toBe('rgb(7, 24, 39)');
  await page.screenshot({ path: `test-results/screens/dark-profile-${name}.png`, fullPage: true });
});
