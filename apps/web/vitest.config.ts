import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // e2e/ — Playwright, не vitest
    include: ['test/**/*.test.ts'],
  },
});
