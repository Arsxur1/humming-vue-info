import type { INestApplication } from '@nestjs/common';
import type IORedis from 'ioredis';
import { WebSocketServer, WebSocket } from 'ws';
import { and, eq } from 'drizzle-orm';
import { RENDER_EVENTS_CHANNEL, renderJobs, workspaceMembers, type Db } from '@avatarstudio/db';
import { DB } from '../db/client.js';
import { TokensService } from '../auth/tokens.service.js';
import { REDIS_SUBSCRIBER } from '../queue/queue.module.js';

/**
 * WebSocket прогресса рендера (CLAUDE.md: каждый переход — событие в БД + WS).
 * Подключение: /api/ws?token=<access>. Клиент шлёт {type:'subscribe', jobId}.
 * События приходят из Redis pub/sub (публикуют worker и api).
 */
export function setupRenderEventsWs(app: INestApplication): WebSocketServer {
  const db = app.get<Db>(DB);
  const tokens = app.get(TokensService);
  const subscriber = app.get<IORedis>(REDIS_SUBSCRIBER);

  const wss = new WebSocketServer({ server: app.getHttpServer(), path: '/api/ws' });
  const subscriptions = new Map<string, Set<WebSocket>>();

  void subscriber.subscribe(RENDER_EVENTS_CHANNEL);
  subscriber.on('message', (_channel, raw) => {
    try {
      const event = JSON.parse(raw) as { jobId: string };
      const sockets = subscriptions.get(event.jobId);
      if (!sockets) return;
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) ws.send(raw);
      }
    } catch {
      // битое сообщение в канале — игнорируем
    }
  });

  wss.on('connection', (ws, req) => {
    void (async () => {
      const url = new URL(req.url ?? '', 'http://localhost');
      const token = url.searchParams.get('token') ?? '';
      const payload = await tokens.verifyAccessToken(token);
      if (!payload) {
        ws.close(4401, 'unauthorized');
        return;
      }
      const userId = payload.sub;
      const mySubs = new Set<string>();

      ws.on('message', (raw) => {
        void (async () => {
          try {
            const msg = JSON.parse(String(raw)) as { type?: string; jobId?: string };
            if (msg.type !== 'subscribe' || typeof msg.jobId !== 'string') return;
            const job = await db.query.renderJobs.findFirst({
              columns: { workspaceId: true },
              where: eq(renderJobs.id, msg.jobId),
            });
            if (!job) return;
            const membership = await db.query.workspaceMembers.findFirst({
              where: and(
                eq(workspaceMembers.workspaceId, job.workspaceId),
                eq(workspaceMembers.userId, userId),
              ),
            });
            if (!membership) return;
            let set = subscriptions.get(msg.jobId);
            if (!set) {
              set = new Set();
              subscriptions.set(msg.jobId, set);
            }
            set.add(ws);
            mySubs.add(msg.jobId);
            ws.send(JSON.stringify({ type: 'subscribed', jobId: msg.jobId }));
          } catch {
            // некорректное сообщение клиента — игнорируем
          }
        })();
      });

      ws.on('close', () => {
        for (const jobId of mySubs) {
          subscriptions.get(jobId)?.delete(ws);
        }
      });
    })();
  });

  return wss;
}
