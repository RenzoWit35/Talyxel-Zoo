import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 4317);
// Locally we drive the installed Chrome; CI installs Playwright's own Chromium.
const channel = process.env.CI ? undefined : (process.env.E2E_CHANNEL ?? 'chrome');

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    channel,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, channel } },
  ],
  webServer: {
    command: 'npm run build && npx tsx e2e/start-server.ts',
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PORT: String(port), DATA_DIR: '.e2e-data', AUTH_RATE_LIMIT: '1000' },
  },
});
