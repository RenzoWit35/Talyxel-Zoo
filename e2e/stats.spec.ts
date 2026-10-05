import { expect, test } from '@playwright/test';
import { apiUser, createPark } from './helpers';

test('the owner fills in park statistics and visitors see them on the park page', async ({ page, browser, baseURL }) => {
  const user = await apiUser(baseURL!, 'stats');
  const park = await createPark(user, { title: 'Stats Zoo' });
  await user.loginPage(page);
  await page.goto(`/zoos/${park.id}/edit`);

  await page.locator('.planner-stats-btn').click();
  const dialog = page.getByRole('dialog', { name: 'Park statistics' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('In-game date').fill('Year 2, May');
  await dialog.getByLabel('Guests', { exact: true }).fill('1.5');
  await dialog.getByRole('button', { name: 'Save stats' }).click();
  await expect(dialog.locator('.form-error')).toHaveText('Guests must be a whole number');

  await dialog.getByLabel('Guests', { exact: true }).fill('1250');
  await dialog.getByLabel('Zoo rating').fill('4.5');
  await dialog.getByLabel('Monthly profit').fill('-300');
  await dialog.getByRole('button', { name: 'Add a stat' }).click();
  await dialog.getByLabel('Extra stat 1 name').fill('Gift shop');
  await dialog.getByLabel('Extra stat 1 value').fill('$3,400 a month');
  await page.screenshot({ path: `test-results/screens/stats-form-${test.info().project.name}.png` });
  await dialog.getByRole('button', { name: 'Save stats' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.stat-mini')).toContainText('1,250');

  await user.api.post(`/api/zoos/${park.id}/publish`, { data: {} });
  const visitor = await browser.newPage();
  await visitor.goto(`/z/${park.id}`);
  const section = visitor.locator('.park-stats');
  await expect(section.getByRole('heading', { name: 'Park statistics' })).toBeVisible();
  await expect(section).toContainText('1,250');
  await expect(section).toContainText('4.5 ★');
  await expect(section).toContainText('−$300');
  await expect(section).toContainText('In-game Year 2, May');
  await expect(section).toContainText('$3,400 a month');
  await expect(section.getByRole('button', { name: 'Update stats' })).toHaveCount(0);
  await section.scrollIntoViewIfNeeded();
  await visitor.screenshot({ path: `test-results/screens/stats-view-${test.info().project.name}.png` });
  await visitor.close();
});
