import { expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test';

export const PASSWORD = 'e2e-password-123';

let counter = 0;
/** A username that is unique across parallel workers and reruns (max 24 chars). */
export function uniqueName(prefix: string) {
  counter++;
  const suffix = `${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}${counter}`;
  return `${prefix.slice(0, 10)}_${suffix}`.slice(0, 24);
}

export interface ApiUser {
  username: string;
  api: APIRequestContext;
  /** Copy this user's session cookie into a browser page. */
  loginPage: (page: Page) => Promise<void>;
}

/** Registers a user through the API and returns a logged-in request context. */
export async function apiUser(baseURL: string, prefix = 'user', displayName?: string): Promise<ApiUser> {
  const username = uniqueName(prefix);
  const api = await playwrightRequest.newContext({ baseURL, extraHTTPHeaders: { 'x-talyxel': '1' } });
  const res = await api.post('/api/auth/register', { data: { username, password: PASSWORD, displayName: displayName ?? username } });
  expect(res.status(), await res.text()).toBe(201);
  return {
    username,
    api,
    loginPage: async (page: Page) => {
      const { cookies } = await api.storageState();
      await page.context().addCookies(cookies);
      // These tests aren't about the first-visit planner tour; e2e/tutorial.spec.ts is.
      await page.addInitScript(() => localStorage.setItem('talyxel.tour.planner.v1', 'done'));
    },
  };
}

export const square = (x: number, y: number, size: number): [number, number][] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
];

export async function createPark(
  user: ApiUser,
  body: { title: string; parkType?: 'zoo' | 'theme_park'; width?: number; height?: number; description?: string },
) {
  const res = await user.api.post('/api/zoos', { data: { width: 300, height: 200, ...body } });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as { id: number; title: string };
}

export async function addShape(user: ApiUser, zooId: number, body: Record<string, unknown>) {
  const res = await user.api.post(`/api/zoos/${zooId}/habitats`, { data: body });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as { id: number; name: string };
}

/** Smallest valid PNG (1×1). */
export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
