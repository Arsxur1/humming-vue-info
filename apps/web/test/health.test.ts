import { describe, expect, it } from 'vitest';
import { healthLabel } from '../src/health.js';

describe('healthLabel', () => {
  it('даёт человекочитаемый статус для каждого состояния', () => {
    expect(healthLabel('checking')).toMatch(/Проверяем/);
    expect(healthLabel('ok')).toMatch(/работает/);
    expect(healthLabel('down')).toMatch(/недоступен/);
  });
});
