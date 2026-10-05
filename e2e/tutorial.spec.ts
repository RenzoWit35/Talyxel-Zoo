import { expect, test, type Page } from '@playwright/test';
import { PASSWORD, uniqueName } from './helpers';

const shot = (name: string) => `test-results/screens/${name}-${test.info().project.name}.png`;
const settle = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));

test('a new builder gets a welcome, a planner tour and a checklist that ticks itself off', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Username').fill(uniqueName('newbie'));
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  // Welcome: four slides, ending in "Plan my first park".
  await expect(page.getByRole('dialog', { name: 'Welcome to Talyxel Park' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: shot('welcome') });
  for (const title of ['Draw your park', 'Share updates and ask questions', 'Keep track of your stats']) {
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('dialog', { name: title })).toBeVisible();
  }
  await page.getByRole('link', { name: 'Plan my first park' }).click();
  await expect(page).toHaveURL(/\/zoos\?new=1$/);
  await page.getByLabel('Name').fill('Tutorial Zoo');
  await page.getByRole('button', { name: 'Create & open planner' }).click();

  // First visit to the planner: a six-step tour.
  const tour = page.getByRole('dialog', { name: 'Add things to your map' });
  await expect(tour).toBeVisible();
  await expect(tour).toContainText('1 of 6');
  await settle(page);
  await page.screenshot({ path: shot('tour-1') });
  for (const title of ['Your tools', 'Draw on the map', 'Details and photos', 'Park statistics']) {
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('dialog', { name: title })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'Publish and share' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: shot('tour-6') });
  await page.getByRole('button', { name: 'Start building' }).click();
  await expect(page.locator('.tour')).toHaveCount(0);

  // It doesn't come back on its own, but the help button replays it.
  await page.reload();
  await expect(page.getByLabel('Park name')).toHaveValue('Tutorial Zoo');
  await expect(page.locator('.tour')).toHaveCount(0);
  await page.getByRole('button', { name: 'Planner tour' }).click();
  await expect(page.getByRole('dialog', { name: 'Add things to your map' })).toBeVisible();
  await page.keyboard.press('Escape');

  // The checklist on the feed already ticked "Create your first park".
  await page.goto('/');
  const checklist = page.locator('.getting-started');
  await expect(checklist).toContainText('1 of 8 done');
  await expect(checklist.locator('.gs-step.done')).toContainText('Create your first park');
  await expect(checklist.locator('.gs-step.next')).toContainText('Draw a habitat or a ride');
  await page.screenshot({ path: shot('checklist') });

  // "Write a post" opens the composer.
  await checklist.locator('.gs-step', { hasText: 'Share an update' }).getByRole('link').click();
  await expect(page.getByLabel('Your update')).toBeFocused();
  await page.getByLabel('Your update').fill('Hello park friends!');
  await page.getByRole('button', { name: 'Share update' }).click();
  await expect(checklist).toContainText('2 of 8 done');

  // Hide it, then bring it back from the guide.
  await checklist.getByRole('button', { name: 'Hide the checklist' }).click();
  await expect(page.locator('.getting-started')).toHaveCount(0);
  await page.goto('/guide');
  await expect(page.getByRole('heading', { name: 'How Talyxel Park works' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Guide contents' }).getByRole('link')).toHaveCount(10);
  await page.screenshot({ path: shot('guide'), fullPage: true });
  await page.getByRole('button', { name: 'Show my checklist' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.getting-started')).toBeVisible();
});

test('the guide is readable without an account', async ({ page }) => {
  await page.goto('/guide');
  await expect(page.getByRole('heading', { name: 'Drawing the map' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create an account' }).first()).toBeVisible();
  await page.getByRole('navigation', { name: 'Guide contents' }).getByRole('link', { name: 'Park statistics' }).click();
  await expect(page).toHaveURL(/#stats$/);
});
