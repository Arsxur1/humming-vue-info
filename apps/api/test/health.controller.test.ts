import { describe, expect, it } from 'vitest';
import { HealthController } from '../src/health/health.controller.js';

describe('HealthController', () => {
  it('возвращает ok с временем и аптаймом', () => {
    const res = new HealthController().check();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('api');
    expect(Number.isNaN(Date.parse(res.timestamp))).toBe(false);
    expect(res.uptimeSec).toBeGreaterThanOrEqual(0);
  });
});
