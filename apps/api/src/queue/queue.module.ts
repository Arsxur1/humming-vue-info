import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { Env } from '@avatarstudio/shared';
import { RENDER_QUEUE_NAME } from '@avatarstudio/shared';
import { ENV, envProvider } from '../common/env.provider.js';

export const RENDER_QUEUE = Symbol('RENDER_QUEUE');
export const REDIS_PUBLISHER = Symbol('REDIS_PUBLISHER');
export const REDIS_SUBSCRIBER = Symbol('REDIS_SUBSCRIBER');

@Global()
@Module({
  providers: [
    envProvider,
    {
      provide: RENDER_QUEUE,
      useFactory: (env: Env) =>
        new Queue(RENDER_QUEUE_NAME, { connection: new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null }) }),
      inject: [ENV],
    },
    {
      provide: REDIS_PUBLISHER,
      useFactory: (env: Env) => new IORedis(env.REDIS_URL),
      inject: [ENV],
    },
    {
      provide: REDIS_SUBSCRIBER,
      useFactory: (env: Env) => new IORedis(env.REDIS_URL),
      inject: [ENV],
    },
  ],
  exports: [RENDER_QUEUE, REDIS_PUBLISHER, REDIS_SUBSCRIBER],
})
export class QueueModule implements OnApplicationShutdown {
  constructor(
    @Inject(RENDER_QUEUE) private readonly queue: Queue,
    @Inject(REDIS_PUBLISHER) private readonly publisher: IORedis,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: IORedis,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
    this.publisher.disconnect();
    this.subscriber.disconnect();
  }
}
