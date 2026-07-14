import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import helmet from 'helmet';
import { loadEnv } from '@avatarstudio/shared';
import { AppModule } from './app.module.js';
import { createDb } from '@avatarstudio/db';
import { runMigrations } from './db/migrate.js';
import { setupRenderEventsWs } from './renders/render-events.ws.js';
import { seedGlobalTemplates } from './templates/templates.service.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();

  await runMigrations(env.DATABASE_URL);
  console.log('[api] миграции БД применены');
  {
    const { db, pool } = createDb(env.DATABASE_URL);
    const seeded = await seedGlobalTemplates(db);
    if (seeded) console.log(`[api] стоковых шаблонов добавлено: ${seeded}`);
    await pool.end();
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // За балансировщиком/прокси: доверяем X-Forwarded-* → корректный req.ip для rate-limit
  app.set('trust proxy', 1);
  // Security-заголовки. CSP выключен: API не отдаёт HTML, а кросс-доменный доступ
  // регулируется CORS; иначе дефолтный CSP мешал бы фронтенду.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
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
