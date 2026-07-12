import { Worker, UnrecoverableError } from 'bullmq';
import IORedis from 'ioredis';
import { loadEnv, RENDER_QUEUE_NAME } from '@avatarstudio/shared';
import { createDb, finalizeRenderJob, recordRenderEvent } from '@avatarstudio/db';
import { createStorageFromEnv } from '@avatarstudio/storage';
import { MockTTSProvider } from './providers/mock-tts.js';
import { MockAvatarDriver } from './providers/mock-avatar.js';
import { C2paSigner } from './c2pa.js';
import { startDevTsa, type DevTsa } from './dev-tsa.js';
import {
  JobCancelledError,
  PermanentRenderError,
  processRenderJob,
  type PipelineContext,
} from './pipeline.js';

const env = loadEnv();
const { db, pool } = createDb(env.DATABASE_URL);
const storage = createStorageFromEnv(env);

// maxRetriesPerRequest: null — требование BullMQ для блокирующих соединений.
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const publisher = new IORedis(env.REDIS_URL);

connection.on('error', (err) => {
  console.error(`[worker] Redis недоступен (${env.REDIS_URL}): ${err.message}. Поднять: docker compose up -d redis`);
});

// C2PA обязателен; без внешнего TSA поднимаем встроенный dev-TSA (RFC 3161 на openssl)
let devTsa: DevTsa | null = null;
const tsaUrl = env.C2PA_TSA_URL ?? (devTsa = await startDevTsa()).url;
if (devTsa) console.log(`[worker] dev-TSA поднят на ${tsaUrl} (production: задайте C2PA_TSA_URL)`);

const ctx: PipelineContext = {
  db,
  storage,
  publisher,
  // Мок-провайдеры Этапа 4; реальные адаптеры подключатся на Этапе 7 за теми же интерфейсами
  tts: new MockTTSProvider(),
  avatar: new MockAvatarDriver(),
  c2pa: new C2paSigner(env, tsaUrl),
};

interface RenderJobPayload {
  jobId: string;
}

const worker = new Worker<RenderJobPayload>(
  RENDER_QUEUE_NAME,
  async (job) => {
    const { jobId } = job.data;
    try {
      await processRenderJob(ctx, jobId);
    } catch (err) {
      if (err instanceof JobCancelledError) {
        console.log(`[worker] job ${jobId} отменён пользователем`);
        return;
      }
      if (err instanceof PermanentRenderError) {
        await finalizeRenderJob(db, jobId, 'failed', {
          errorCode: err.code,
          errorMessage: err.message,
        });
        await safeEvent(jobId, 'failed', err.message);
        throw new UnrecoverableError(err.message);
      }
      // Транзиентная ошибка: BullMQ ретраит (attempts из очереди); на последней — failed + автовозврат
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (isLastAttempt) {
        const message =
          'Рендер не удался из-за внутренней ошибки. Кредиты возвращены — попробуйте ещё раз чуть позже.';
        await finalizeRenderJob(db, jobId, 'failed', {
          errorCode: 'RENDER_FAILED',
          errorMessage: message,
        });
        await safeEvent(jobId, 'failed', message);
      } else {
        await safeEvent(jobId, 'running', `транзиентный сбой, повтор ${job.attemptsMade + 1}: ${(err as Error).message}`);
      }
      throw err;
    }
  },
  { connection, concurrency: 2 },
);

async function safeEvent(jobId: string, status: string, message: string): Promise<void> {
  try {
    const job = await db.query.renderJobs.findFirst({
      columns: { workspaceId: true, stage: true, progress: true },
      where: (t, { eq }) => eq(t.id, jobId),
    });
    if (!job) return;
    await recordRenderEvent(db, publisher, {
      jobId,
      workspaceId: job.workspaceId,
      status,
      stage: job.stage,
      progress: job.progress,
      message,
    });
  } catch (err) {
    console.error('[worker] не удалось записать событие:', err);
  }
}

worker.on('ready', () => {
  console.log(`[worker] слушаю очередь "${RENDER_QUEUE_NAME}" (${env.REDIS_URL}), провайдеры: ${ctx.tts.name} + ${ctx.avatar.name}`);
});
worker.on('completed', (job) => {
  console.log(`[worker] job ${job.data.jobId} завершён`);
});
worker.on('failed', (job, err) => {
  console.error(`[worker] job ${job?.data.jobId ?? '?'} failed: ${err.message}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] ${signal} — graceful shutdown`);
  await worker.close();
  await devTsa?.close();
  publisher.disconnect();
  connection.disconnect();
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
