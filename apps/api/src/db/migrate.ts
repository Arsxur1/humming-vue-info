import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadEnv } from '@avatarstudio/shared';
import { createDb } from './client.js';

const MIGRATIONS_FOLDER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../drizzle',
);

export async function runMigrations(databaseUrl: string): Promise<void> {
  const { db, pool } = createDb(databaseUrl);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

// Запуск напрямую: pnpm db:migrate
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = loadEnv();
  runMigrations(env.DATABASE_URL)
    .then(() => {
      console.log('[db] миграции применены');
    })
    .catch((err) => {
      console.error('[db] миграции упали:', err);
      process.exit(1);
    });
}
