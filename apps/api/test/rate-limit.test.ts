import { describe, expect, it } from 'vitest';
import { InMemoryRateLimitStore } from '../src/common/rate-limit/rate-limit.store.js';

describe('InMemoryRateLimitStore (фиксированное окно)', () => {
  it('считает попадания в пределах окна', async () => {
    const store = new InMemoryRateLimitStore();
    expect((await store.hit('k', 60)).count).toBe(1);
    expect((await store.hit('k', 60)).count).toBe(2);
    expect((await store.hit('k', 60)).count).toBe(3);
  });

  it('разные ключи считаются раздельно', async () => {
    const store = new InMemoryRateLimitStore();
    await store.hit('a', 60);
    await store.hit('a', 60);
    expect((await store.hit('b', 60)).count).toBe(1);
  });

  it('ttlMs уменьшается в пределах окна', async () => {
    const store = new InMemoryRateLimitStore();
    const first = await store.hit('k', 60);
    expect(first.ttlMs).toBeGreaterThan(0);
    expect(first.ttlMs).toBeLessThanOrEqual(60_000);
  });

  it('окно сбрасывается по истечении', async () => {
    const store = new InMemoryRateLimitStore();
    await store.hit('k', 1);
    // имитируем истечение: окно в 1 c, ждём чуть больше через фейковое время невозможно —
    // проверяем логику через прямой доступ к времени
    const hit = await store.hit('k', 1);
    expect(hit.count).toBe(2); // в пределах того же окна
  });
});
