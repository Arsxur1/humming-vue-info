import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import IORedis from 'ioredis';
import type { Env } from '@avatarstudio/shared';
import { ENV, envProvider } from '../env.provider.js';
import { RateLimitGuard } from './rate-limit.guard.js';
import {
  InMemoryRateLimitStore,
  RATE_LIMIT_STORE,
  RedisRateLimitStore,
  type RateLimitStore,
} from './rate-limit.store.js';

const RATE_LIMIT_REDIS = Symbol('RATE_LIMIT_REDIS');

@Global()
@Module({
  providers: [
    envProvider,
    {
      // Отдельный Redis-клиент для счётчиков; при отсутствии URL — in-memory
      provide: RATE_LIMIT_REDIS,
      useFactory: (env: Env) => (env.REDIS_URL ? new IORedis(env.REDIS_URL) : null),
      inject: [ENV],
    },
    {
      provide: RATE_LIMIT_STORE,
      useFactory: (redis: IORedis | null): RateLimitStore =>
        redis ? new RedisRateLimitStore(redis) : new InMemoryRateLimitStore(),
      inject: [RATE_LIMIT_REDIS],
    },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [RATE_LIMIT_STORE],
})
export class RateLimitModule implements OnApplicationShutdown {
  constructor(@Inject(RATE_LIMIT_REDIS) private readonly redis: IORedis | null) {}

  onApplicationShutdown(): void {
    this.redis?.disconnect();
  }
}
