import type { Db } from './client.js';
import { renderJobEvents } from './schema.js';

/** Минимальный контракт публикации (реализуется ioredis.publish). */
export interface RenderEventPublisher {
  publish(channel: string, message: string): Promise<unknown>;
}

export const RENDER_EVENTS_CHANNEL = 'render:events';

export interface RenderJobEvent {
  jobId: string;
  workspaceId: string;
  status: string;
  stage: string;
  progress: number;
  message?: string;
}

/** Каждый переход — строка в БД + сообщение в pub/sub → WebSocket (CLAUDE.md). */
export async function recordRenderEvent(
  db: Db,
  publisher: RenderEventPublisher | null,
  event: RenderJobEvent,
): Promise<void> {
  await db.insert(renderJobEvents).values({
    jobId: event.jobId,
    status: event.status,
    stage: event.stage,
    progress: event.progress,
    message: event.message ?? null,
  });
  if (publisher) {
    await publisher.publish(
      RENDER_EVENTS_CHANNEL,
      JSON.stringify({ ...event, ts: new Date().toISOString() }),
    );
  }
}
