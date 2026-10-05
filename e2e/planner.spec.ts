import { expect, test, type Page } from '@playwright/test';
import { addShape, apiUser, createPark } from './helpers';

/** Canvas centre and a scale factor so the same drawing fits on desktop and phone. */
async function canvas(page: Page) {
  const box = (await page.locator('.map-canvas').boundingBox())!;
  const s = Math.min(box.width, box.height) / 700;
  const at = (dx: number, dy: number) => [box.x + box.width / 2 + dx * s, box.y + box.height / 2 + dy * s] as const;
  return { at };
}

/** On phones the details panel is a bottom sheet that covers the map after a shape is created. */
async function closeSheet(page: Page) {
  const sheet = page.locator('.planner-panel.open');
  if ((page.viewportSize()?.width ?? 1280) <= 900 && (await sheet.count())) {
    await page.getByRole('button', { name: 'Show details panel' }).click();
    await expect(sheet).toHaveCount(0);
    // The sheet slides away; clicks during the slide would land on it instead of the map.
    await expect.poll(() => page.locator('.planner-panel').evaluate((el) => el.getBoundingClientRect().top >= window.innerHeight - 1)).toBe(true);
  }
}

test('adds a utility, a walk route and an area of interest from the Add palette', async ({ page, baseURL }) => {
  const user = await apiUser(baseURL!, 'planner');
  const park = await createPark(user, { title: 'Palette Park' });
  await user.loginPage(page);
  await page.goto(`/zoos/${park.id}/edit`);

  const palette = page.getByRole('toolbar', { name: 'Add to the map' });
  await expect(palette).toBeVisible();
  const { at } = await canvas(page);

  // Utility as a rectangle.
  await palette.getByRole('button', { name: 'Utility' }).click();
  await page.keyboard.press('r');
  await page.mouse.move(...at(-130, 30));
  await page.mouse.down();
  await page.mouse.move(...at(-90, 60), { steps: 4 });
  await page.mouse.move(...at(-50, 90), { steps: 4 });
  await page.mouse.up();
  await expect(page.getByRole('heading', { name: 'Utility details' })).toBeVisible();
  await page.getByLabel('Utility type').fill('Power substation');
  await closeSheet(page);

  // Walk route as a line: three clicks, then Enter.
  await palette.getByRole('button', { name: 'Walk route' }).click();
  await expect(page.locator('.draw-hint')).toContainText('Click where the route starts');
  await page.mouse.click(...at(-160, -20));
  await page.mouse.click(...at(-20, -50));
  await page.mouse.click(...at(140, -20));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Walk route details' })).toBeVisible();
  await expect(page.locator('.planner-panel .stat-row').first()).toContainText('Walk time');
  await expect(page.locator('.shape.kind-route')).toHaveCount(1);
  await closeSheet(page);

  // Area of interest as a freeform shape.
  await palette.getByRole('button', { name: 'Area of interest' }).click();
  await page.mouse.click(...at(40, 40));
  await page.mouse.click(...at(130, 40));
  await page.mouse.click(...at(110, 100));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Area of interest details' })).toBeVisible();
  await expect(page.locator('.map-pin')).toHaveCount(1);
  await closeSheet(page);

  // The layers menu hides walk routes.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Layers' }).click();
  await page.locator('.layers-menu').getByLabel('Walk route').uncheck();
  await expect(page.locator('.shape.kind-route')).toHaveCount(0);
  await page.locator('.layers-menu').getByRole('button', { name: 'Show everything' }).click();
  await expect(page.locator('.shape.kind-route')).toHaveCount(1);

  // Everything was saved.
  await expect
    .poll(async () => ((await (await user.api.get(`/api/zoos/${park.id}`)).json()).habitats as { kind: string }[]).map((h) => h.kind).sort())
    .toEqual(['interest', 'route', 'utility']);
  await page.screenshot({ path: `test-results/screens/planner-palette-${test.info().project.name}.png` });
});

test('visitors see walk route facts and can toggle layers on a published park', async ({ page, baseURL }) => {
  const user = await apiUser(baseURL!, 'routes');
  const park = await createPark(user, { title: 'Route Park' });
  await addShape(user, park.id, { name: 'Lion Ridge', kind: 'habitat', species: 'African Lion', points: [[20, 20], [120, 20], [120, 80], [20, 80]] });
  await addShape(user, park.id, { name: 'Power station', kind: 'utility', species: 'Power substation', points: [[200, 20], [260, 20], [260, 60], [200, 60]] });
  await addShape(user, park.id, { name: 'Lion lookout', kind: 'interest', species: 'Viewpoint', points: [[130, 120], [180, 120], [180, 170], [130, 170]] });
  await addShape(user, park.id, { name: 'Savanna loop', kind: 'route', species: 'Guest walk', points: [[10, 100], [290, 100]] });
  await user.api.post(`/api/zoos/${park.id}/publish`, { data: {} });

  await page.goto(`/z/${park.id}`);
  await expect(page.getByText('of walk routes')).toBeVisible();
  const chips = page.getByRole('group', { name: 'Show on the map' });
  await expect(chips.getByRole('button')).toHaveCount(4);

  if (test.info().project.name === 'desktop') {
    const line = (await page.locator('.shape.kind-route .route-hit').boundingBox())!;
    await page.mouse.move(line.x + line.width * 0.3, line.y + line.height / 2);
    await expect(page.locator('.hover-card')).toContainText('Walk time');
    await expect(page.locator('.hover-card')).toContainText('Savanna loop');
  }

  await chips.getByRole('button', { name: /Walk route/ }).click();
  await expect(page.locator('.shape.kind-route')).toHaveCount(0);
  await expect(page.locator('.shape.kind-utility')).toHaveCount(1);
  await page.screenshot({ path: `test-results/screens/park-layers-${test.info().project.name}.png`, fullPage: true });
});
