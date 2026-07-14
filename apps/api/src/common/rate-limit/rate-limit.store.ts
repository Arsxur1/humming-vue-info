import type IORedis from 'ioredis';

export interface RateLimitHit {
  /** Число запросов в текущем окне (включая этот). */
  count: number;
  /** Сколько миллисекунд осталось до сброса окна. */
  ttlMs: number;
}

export interface RateLimitStore {
  hit(key: string, windowSec: number): Promise<RateLimitHit>;
}

export const RATE_LIMIT_STORE = Symbol('RATE_LIMIT_STORE');

/** Фиксированное окно в памяти (dev/тесты/один инстанс). */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, windowSec: number): Promise<RateLimitHit> {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowSec * 1000 };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    // Ленивая очистка, чтобы Map не рос бесконечно
    if (this.buckets.size > 10_000) {
      for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
    }
    return { count: bucket.count, ttlMs: bucket.resetAt - now };
  }
}

/** Фиксированное окно в Redis (несколько инстансов API). */
export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: IORedis) {}

  async hit(key: string, windowSec: number): Promise<RateLimitHit> {
    const redisKey = `ratelimit:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) await this.redis.expire(redisKey, windowSec);
    const ttl = await this.redis.pttl(redisKey);
    return { count, ttlMs: ttl > 0 ? ttl : windowSec * 1000 };
  }
}
