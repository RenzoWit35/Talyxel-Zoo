import { expect, test } from '@playwright/test';
import { apiUser } from './helpers';

test('the bell shows new likes, comments and followers and clears when opened', async ({ page, baseURL }) => {
  const rosa = await apiUser(baseURL!, 'rosa', 'Rosa Verhoeven');
  const kai = await apiUser(baseURL!, 'kai', 'Kai Lindqvist');
  const post = await (await rosa.api.post('/api/posts', { data: { kind: 'question', body: 'Which biome for the red pandas?' } })).json();
  await kai.api.put(`/api/users/${rosa.username}/follow`);
  await kai.api.put(`/api/activity/${post.id}/like`);
  await kai.api.post(`/api/activity/${post.id}/comments`, { data: { body: 'Temperate, with lots of climbing' } });

  await rosa.loginPage(page);
  await page.goto('/');
  const bell = page.getByRole('button', { name: /^Notifications/ });
  await expect(bell).toHaveAccessibleName('Notifications, 3 new');
  await expect(bell.locator('.notif-badge')).toHaveText('3');

  await bell.click();
  const panel = page.getByRole('dialog', { name: 'Notifications' });
  await expect(panel.locator('.notif-item')).toHaveCount(3);
  await expect(panel).toContainText('Kai Lindqvist started following you.');
  await expect(panel).toContainText('liked your post “Which biome for the red pandas?”');
  await expect(panel).toContainText('Temperate, with lots of climbing');
  await expect(bell.locator('.notif-badge')).toHaveCount(0);
  await panel.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await page.screenshot({ path: `test-results/screens/notifications-${test.info().project.name}.png` });

  await panel.locator('.notif-item', { hasText: 'commented' }).click();
  await expect(page).toHaveURL(new RegExp(`/p/${post.id}$`));
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
});
