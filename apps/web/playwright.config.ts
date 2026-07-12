import { defineConfig } from '@playwright/test';

/**
 * E2E Этапа 6: реальный стек — api + worker (Postgres, Redis) + vite.
 * Бэкенд поднимается скриптом e2e/start-backend.mjs.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    // Предустановленный Chromium окружения (версия может отличаться от пина Playwright)
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
  webServer: [
    {
      command: 'node e2e/start-backend.mjs',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
