import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import { loadEnv } from '@avatarstudio/shared';
import { AppModule } from './app.module.js';
import { runMigrations } from './db/migrate.js';
import { setupRenderEventsWs } from './renders/render-events.ws.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();

  await runMigrations(env.DATABASE_URL);
  console.log('[api] миграции БД применены');

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // Тела загрузок (fs-драйвер) — бинарные, мимо JSON-парсера
  app.use('/api/uploads', express.raw({ type: '*/*', limit: '500mb' }));
  app.enableCors({ origin: env.WEB_ORIGIN });
  app.enableShutdownHooks();

  await app.listen(env.API_PORT);
  setupRenderEventsWs(app);
  console.log(
    `[api] listening on http://localhost:${env.API_PORT} (health: /api/health, ws: /api/ws)`,
  );
}

bootstrap().catch((err) => {
  console.error('[api] fatal on bootstrap:', err);
  process.exit(1);
});
