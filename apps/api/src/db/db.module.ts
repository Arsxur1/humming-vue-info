import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type pg from 'pg';
import type { Env } from '@avatarstudio/shared';
import { ENV, envProvider } from '../common/env.provider.js';
import { createDb, DB, PG_POOL } from './client.js';

const DB_CTX = Symbol('DB_CTX');

@Global()
@Module({
  providers: [
    envProvider,
    {
      provide: DB_CTX,
      useFactory: (env: Env) => createDb(env.DATABASE_URL),
      inject: [ENV],
    },
    {
      provide: DB,
      useFactory: (ctx: ReturnType<typeof createDb>) => ctx.db,
      inject: [DB_CTX],
    },
    {
      provide: PG_POOL,
      useFactory: (ctx: ReturnType<typeof createDb>) => ctx.pool,
      inject: [DB_CTX],
    },
  ],
  exports: [ENV, DB, PG_POOL],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
