import { defineConfig, devices } from '@playwright/test';

const WEB = 5273;
const API = 3101;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB}`,
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  },
  // Chrome de verdade (não o Chromium do Playwright): precisa decodificar H.264 dos proxies.
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: 'pnpm --filter @editor/api exec tsx src/e2e-server.ts',
      cwd: '../..',
      url: `http://localhost:${API}/api/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: { PORT: String(API), WEB_ORIGIN: `http://localhost:${WEB}` },
    },
    {
      command: 'pnpm --filter @editor/web exec vite',
      cwd: '../..',
      url: `http://localhost:${WEB}`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { WEB_PORT: String(WEB), API_ORIGIN: `http://localhost:${API}` },
    },
  ],
});
