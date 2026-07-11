import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadEnv } from '@avatarstudio/shared';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();

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
