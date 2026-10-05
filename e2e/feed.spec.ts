import { expect, test } from '@playwright/test';
import { paintPostcard } from '../server/seed-images';
import { apiUser } from './helpers';

const screenshot = (name: string) => `test-results/screens/${name}-${test.info().project.name}.png`;

test('builders share updates and questions; followers like, answer and open the post', async ({ page, browser, baseURL }) => {
  const rosa = await apiUser(baseURL!, 'rosa', 'Rosa Verhoeven');
  const kai = await apiUser(baseURL!, 'kai', 'Kai Lindqvist');
  await kai.api.put(`/api/users/${rosa.username}/follow`);

  // Rosa shares an update with two screenshots…
  await rosa.loginPage(page);
  await page.goto('/social');
  await page.getByRole('button', { name: 'Share an update' }).first().click();
  await page.getByLabel('Your update').fill('Finished the savanna overlook today!');
  await page.locator('.composer input[type=file]').setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: paintPostcard('grassland', 11) },
    { name: 'b.png', mimeType: 'image/png', buffer: paintPostcard('tropical', 23) },
  ]);
  await expect(page.locator('.composer-photo')).toHaveCount(2);
  await page.getByRole('button', { name: 'Share update' }).click();
  const update = page.locator('.post-card', { hasText: 'Finished the savanna overlook today!' });
  await expect(update).toBeVisible();
  await expect(update.locator('.post-media-photo')).toHaveCount(2);
  await expect(update.locator('.post-title')).toHaveText('Finished the savanna overlook today!');

  // …and asks a question.
  await page.getByRole('button', { name: 'Share an update' }).first().click();
  await page.getByRole('radio', { name: 'Question' }).click();
  await page.getByLabel('Your question').fill('Should the giraffes get a second barn?');
  await page.getByRole('button', { name: 'Ask question' }).click();
  const question = page.locator('.post-card.is-question').first();
  await expect(question.locator('.post-title')).toHaveText('Should the giraffes get a second barn?');

  // Kai sees both, double-clicks to like the update and answers the question.
  const kaiPage = await browser.newPage();
  await kai.loginPage(kaiPage);
  await kaiPage.goto('/social');
  const kaiUpdate = kaiPage.locator('.post-card', { hasText: 'Finished the savanna overlook today!' });
  await expect(kaiUpdate).toBeVisible();
  await kaiUpdate.locator('.post-media').dblclick();
  await expect(kaiUpdate.getByRole('button', { name: 'Unlike' })).toHaveAttribute('aria-pressed', 'true');
  await expect(kaiUpdate.locator('.post-likes')).toContainText('1 like');

  const kaiQuestion = kaiPage.locator('.post-card.is-question');
  await kaiQuestion.getByLabel('Your answer').fill('Yes — and a shaded feeding platform');
  await kaiQuestion.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(kaiQuestion.locator('.comment')).toContainText('Yes — and a shaded feeding platform');
  await kaiPage.screenshot({ path: screenshot('feed'), fullPage: true });

  // The Questions filter shows only questions.
  await kaiPage.getByRole('tab', { name: 'Questions' }).click();
  await expect(kaiPage).toHaveURL(/filter=questions/);
  await expect(kaiPage.locator('.post-card')).toHaveCount(1);
  await expect(kaiPage.locator('.post-card.is-question')).toHaveCount(1);
  await kaiPage.getByRole('tab', { name: 'For you' }).click();
  await expect(kaiPage.locator('.post-card')).toHaveCount(2);

  // The timestamp opens the post on its own page with every comment.
  await kaiQuestion.locator('.post-time').click();
  await expect(kaiPage).toHaveURL(/\/p\/\d+$/);
  await expect(kaiPage.locator('.post-card .comment')).toHaveCount(1);
  await expect(kaiPage.getByRole('button', { name: 'Delete comment' })).toBeVisible();
  await kaiPage.screenshot({ path: screenshot('post-page') });
  await kaiPage.close();

  // Rosa's like count went up, and she can delete her own update.
  await page.reload();
  await expect(update.locator('.post-likes')).toContainText('1 like');
  await update.getByRole('button', { name: 'Post options' }).click();
  await update.getByRole('menuitem', { name: 'Delete post' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete post' }).click();
  await expect(page.locator('.post-card', { hasText: 'Finished the savanna overlook today!' })).toHaveCount(0);
});

test('park activity shows as a card with the top-down map', async ({ page, baseURL }) => {
  const lotte = await apiUser(baseURL!, 'lotte', 'Lotte Bakker');
  const park = await (await lotte.api.post('/api/zoos', { data: { title: 'Thunder Peak', parkType: 'theme_park', width: 300, height: 200 } })).json();
  await lotte.api.post(`/api/zoos/${park.id}/habitats`, { data: { name: 'Thunderbolt', kind: 'coaster', points: [[20, 20], [140, 20], [140, 90], [20, 90]] } });
  await lotte.api.post(`/api/zoos/${park.id}/habitats`, { data: { name: 'Midway', kind: 'route', points: [[10, 120], [290, 120]] } });
  await lotte.api.post(`/api/zoos/${park.id}/publish`, { data: { survey: { question: 'Which ride next?', options: ['Log flume', 'Drop tower'] } } });

  await lotte.loginPage(page);
  await page.goto('/social');
  const card = page.locator('.post-card', { hasText: 'Published a new theme park plan' });
  await expect(card.locator('.post-media-map')).toBeVisible();
  await expect(card.locator('.post-place-pill')).toHaveText('Thunder Peak');
  await expect(card.locator('.post-progress')).toHaveText('0% built');

  // The survey can be answered right in the card.
  const poll = card.locator('.feed-poll');
  await expect(poll).toContainText('Which ride next?');
  await poll.getByRole('button', { name: /Drop tower/ }).click();
  await expect(poll.getByRole('button', { name: /Drop tower/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(poll.getByRole('button', { name: /Drop tower/ })).toContainText('100%');
  await expect(poll).toContainText('1 vote');
  await card.getByRole('button', { name: 'Like' }).click();
  await expect(card.getByRole('button', { name: 'Unlike' })).toBeVisible();
});
