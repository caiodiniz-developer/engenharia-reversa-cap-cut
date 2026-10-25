import { defineConfig, devices } from '@playwright/test';

// E2E do BUILD DE PRODUÇÃO: arquivos estáticos minificados + cabeçalhos de segurança (CSP) + proxy,
// com uma API e um PostgreSQL próprios (portas distintas do E2E de desenvolvimento).
const WEB = 5373;
const API = 3201;

export default defineConfig({
  testDir: './e2e-prod',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${WEB}`, trace: 'retain-on-failure', acceptDownloads: true, launchOptions: { args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } },
  projects: [{ name: 'chrome-prod', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } } }],
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
      command: 'pnpm --filter @editor/web build && node apps/web/scripts/serve-dist.mjs',
      cwd: '../..',
      url: `http://localhost:${WEB}`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: { PORT: String(WEB), API_PORT: String(API) },
    },
  ],
});
