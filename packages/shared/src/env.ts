import { z } from 'zod';

/**
 * Схема окружения для всех сервисов. Ключи провайдеров и прочие секреты
 * добавляются сюда по мере появления — хардкод запрещён (CLAUDE.md).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z
    .string()
    .url()
    .default('postgres://avatarstudio:avatarstudio@localhost:5432/avatarstudio'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().default('avatarstudio'),
  S3_SECRET_KEY: z.string().default('avatarstudio'),
  S3_BUCKET: z.string().default('avatarstudio-dev'),

  // Auth. В production секрет обязан приходить из окружения — дефолт только для dev/test.
  JWT_SECRET: z.string().min(16).default('dev-only-secret-change-me'),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(15 * 60),
  REFRESH_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(30 * 24 * 60 * 60),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Валидирует process.env (или переданный объект). Падает с человекочитаемым
 * перечнем проблем — сервис не должен стартовать с битой конфигурацией.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Некорректная конфигурация окружения:\n${issues}`);
  }
  return parsed.data;
}
