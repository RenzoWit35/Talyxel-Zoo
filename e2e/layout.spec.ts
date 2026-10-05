import { expect, test, type Page } from '@playwright/test';
import { addShape, apiUser, createPark } from './helpers';

/** Pages must never scroll sideways — on phones that shifts everything and taps land on the wrong thing. */
async function expectNoSidewaysScroll(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  const { scrollWidth, clientWidth, culprits } = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: vw,
      culprits: [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((el) => el.offsetParent !== null && el.getBoundingClientRect().right > vw + 1)
        .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`)
        .slice(0, 5),
    };
  });
  expect(scrollWidth, `${url} is wider than the screen because of ${culprits.join(', ')}`).toBeLessThanOrEqual(clientWidth);
}

test('pages fit the screen width for visitors', async ({ page }) => {
  for (const url of ['/', '/explore', '/people', '/guide', '/login', '/register']) await expectNoSidewaysScroll(page, url);
});

test('pages fit the screen width for builders', async ({ page, baseURL }) => {
  const user = await apiUser(baseURL!, 'fit', 'Fit Check');
  const park = await createPark(user, { title: 'A park with a rather long name to test wrapping' });
  await addShape(user, park.id, { name: 'Lions', kind: 'habitat', points: [[100, 100], [400, 100], [400, 300], [100, 300]] });
  await user.api.post(`/api/zoos/${park.id}/publish`, { data: {} });
  await user.api.post('/api/posts', { data: { kind: 'question', body: 'Does everything fit on a small phone screen, even with a long question like this one?' } });
  await user.loginPage(page);
  for (const url of ['/', '/social', '/zoos', `/z/${park.id}`, `/u/${user.username}`, '/guide']) await expectNoSidewaysScroll(page, url);
});
