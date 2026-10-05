import { expect, test } from '@playwright/test';
import { PASSWORD, uniqueName } from './helpers';

test('a visitor signs up, creates a plan and lands in the planner', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Talyxel Park home' })).toBeVisible();

  await page.goto('/register');
  const username = uniqueName('smoke');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  // New accounts get a short welcome first.
  await expect(page).toHaveURL(/\/\?welcome=1$/);
  await page.getByRole('dialog', { name: 'Welcome to Talyxel Park' }).getByRole('button', { name: 'Skip' }).click();

  await page.goto('/zoos');
  await page.getByRole('button', { name: 'New plan' }).first().click();
  await page.getByLabel('Name').fill('Smoke Test Zoo');
  await page.getByRole('button', { name: 'Create & open planner' }).click();

  await expect(page).toHaveURL(/\/zoos\/\d+\/edit$/);
  await page.keyboard.press('Escape'); // first-visit tour
  await expect(page.getByLabel('Park name')).toHaveValue('Smoke Test Zoo');
});
