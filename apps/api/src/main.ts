import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadEnv } from '@avatarstudio/shared';
import { AppModule } from './app.module.js';
import { runMigrations } from './db/migrate.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();

  await runMigrations(env.DATABASE_URL);
  console.log('[api] миграции БД применены');

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: env.WEB_ORIGIN });
  app.enableShutdownHooks();

  await app.listen(env.API_PORT);
  console.log(`[api] listening on http://localhost:${env.API_PORT} (health: /api/health)`);
}

bootstrap().catch((err) => {
  console.error('[api] fatal on bootstrap:', err);
  process.exit(1);
});
