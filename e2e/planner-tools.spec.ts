import { expect, test, type Page } from '@playwright/test';
import { addShape, apiUser, createPark } from './helpers';

const shapes = (page: Page) => page.locator('.map-shapes > .shape');
const outline = (page: Page, id: number) => page.locator(`.shape[data-hid="${id}"] polygon`).first().getAttribute('points');

test('duplicate, copy and paste shapes, undo and redo moves, and show the shortcuts', async ({ page, baseURL }, info) => {
  test.skip(info.project.name === 'phone', 'Keyboard shortcuts are a desktop feature');
  const user = await apiUser(baseURL!, 'tools');
  const park = await createPark(user, { title: 'Tool Park' });
  const lions = await addShape(user, park.id, { name: 'Lion Ridge', kind: 'habitat', points: [[100, 60], [180, 60], [180, 120], [100, 120]] });
  await user.loginPage(page);
  await page.goto(`/zoos/${park.id}/edit`);
  await expect(shapes(page)).toHaveCount(1);

  // Select by clicking the shape, then duplicate with Ctrl+D.
  const box = (await page.locator(`.shape[data-hid="${lions.id}"] polygon`).first().boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole('heading', { name: 'Habitat details' })).toBeVisible();
  await page.keyboard.press('Control+d');
  await expect(shapes(page)).toHaveCount(2);
  await expect(page.locator('.planner-panel').getByLabel('Name')).toHaveValue('Lion Ridge copy');

  // Copy and paste twice: each paste lands a step further away.
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await page.keyboard.press('Control+v');
  await expect(shapes(page)).toHaveCount(4);

  // Nudge the original, undo, redo.
  await page.locator(`.shape[data-hid="${lions.id}"] polygon`).first().click({ position: { x: 5, y: 5 } });
  const before = await outline(page, lions.id);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => outline(page, lions.id)).not.toBe(before);
  const moved = await outline(page, lions.id);
  await page.keyboard.press('Control+z');
  await expect.poll(() => outline(page, lions.id)).toBe(before);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => outline(page, lions.id)).toBe(moved);
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();

  await page.keyboard.press('Escape');
  await page.keyboard.press('?');
  const overlay = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(overlay).toContainText('Duplicate');
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  await page.screenshot({ path: 'test-results/screens/shortcuts-desktop.png' });
  await page.keyboard.press('Escape');
  await expect(overlay).toHaveCount(0);

  await expect
    .poll(async () => ((await (await user.api.get(`/api/zoos/${park.id}`)).json()).habitats as { name: string }[]).map((h) => h.name).sort())
    .toEqual(['Lion Ridge', 'Lion Ridge copy', 'Lion Ridge copy', 'Lion Ridge copy']);
});

test('the details panel duplicates a shape without a keyboard', async ({ page, baseURL }) => {
  const user = await apiUser(baseURL!, 'dupe');
  const park = await createPark(user, { title: 'Dupe Park' });
  const route = await addShape(user, park.id, { name: 'Safari walk', kind: 'route', points: [[40, 100], [260, 100]] });
  await user.loginPage(page);
  await page.goto(`/zoos/${park.id}/edit`);
  const line = (await page.locator(`.shape[data-hid="${route.id}"] .route-hit`).boundingBox())!;
  await page.mouse.click(line.x + line.width / 2, line.y + line.height / 2);
  await page.locator('.planner-panel').getByRole('button', { name: 'Duplicate' }).click();
  await expect(shapes(page)).toHaveCount(2);
  await expect(page.locator('.planner-panel').getByLabel('Name')).toHaveValue('Safari walk copy');
});
