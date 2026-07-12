import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // e2e-файлы работают с одной БД (TRUNCATE в beforeAll) — только последовательно
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
});
