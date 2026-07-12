import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // ast.ts — только типы, рантайм-кода нет
      exclude: ['src/ast.ts'],
      // Требование Этапа 2 (docs/PLAN.md): покрытие ядра D1 ≥ 95%
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 90,
      },
    },
  },
});
