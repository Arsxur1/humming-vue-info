import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { loadEnv, RENDER_QUEUE_NAME } from '@avatarstudio/shared';
import { processRenderJob, type RenderJobPayload } from './process-job.js';

const env = loadEnv();

// maxRetriesPerRequest: null — требование BullMQ для блокирующих соединений.
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

connection.on('error', (err) => {
  console.error(`[worker] Redis недоступен (${env.REDIS_URL}): ${err.message}. Поднять: docker compose up -d redis`);
});

const worker = new Worker<RenderJobPayload>(
  RENDER_QUEUE_NAME,
  async (job) => processRenderJob(job.data),
  { connection },
);

worker.on('ready', () => {
  console.log(`[worker] слушаю очередь "${RENDER_QUEUE_NAME}" (${env.REDIS_URL})`);
});
worker.on('completed', (job) => {
  console.log(`[worker] job ${job.id} done`);
});
worker.on('failed', (job, err) => {
  console.error(`[worker] job ${job?.id ?? '?'} failed: ${err.message}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] ${signal} — graceful shutdown`);
  await worker.close();
  connection.disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
