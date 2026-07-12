/**
 * E2E Этапа 4 (критерий из docs/PLAN.md): проект из 3 сцен рендерится в
 * связный MP4 с субтитрами; повторный рендер без правок = 0 работы воркеров.
 * Требует Postgres и Redis; worker запускается дочерним процессом (tsx).
 * ffmpeg обязателен (в CI ubuntu-runner он предустановлен).
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import pg from 'pg';
import WebSocket from 'ws';
import { loadEnv } from '@avatarstudio/shared';
import { AppModule } from '../src/app.module.js';
import { runMigrations } from '../src/db/migrate.js';
import { setupRenderEventsWs } from '../src/renders/render-events.ws.js';

const storageDir = mkdtempSync(path.join(tmpdir(), 'avatarstudio-render-'));
process.env.STORAGE_DRIVER = 'fs';
process.env.STORAGE_FS_DIR = storageDir;

const env = loadEnv();
const here = path.dirname(fileURLToPath(import.meta.url));
const tsxBin = path.resolve(here, '../node_modules/.bin/tsx');
const workerEntry = path.resolve(here, '../../worker/src/main.ts');

let app: INestApplication;
let http: ReturnType<INestApplication['getHttpServer']>;
let baseUrl = '';
let pool: pg.Pool;
let workerProc: ChildProcess;
let token = '';
let workspaceId = '';
let projectId = '';

async function pollJob(jobId: string, until: string[], timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await request(http)
      .get(`/api/workspaces/${workspaceId}/renders/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    if (until.includes(res.body.status)) return res.body;
    if (Date.now() > deadline) {
      throw new Error(`job ${jobId} не достиг ${until} за ${timeoutMs}мс: ${res.body.status}/${res.body.stage}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function balance(): Promise<number> {
  const { rows } = await pool.query('SELECT credits_balance FROM workspaces WHERE id = $1', [
    workspaceId,
  ]);
  return Number(rows[0].credits_balance);
}

beforeAll(async () => {
  await runMigrations(env.DATABASE_URL);
  pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  await pool.query(
    'TRUNCATE users, email_verifications, refresh_tokens, workspaces, workspace_members, invitations, audit_log, projects, scenes, layers, project_versions, assets, render_jobs, render_job_events, scene_render_cache, credit_transactions RESTART IDENTITY CASCADE',
  );

  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.use('/api/uploads', express.raw({ type: '*/*', limit: '500mb' }));
  await app.listen(0);
  setupRenderEventsWs(app);
  http = app.getHttpServer();
  const address = http.address() as { port: number };
  baseUrl = `http://127.0.0.1:${address.port}`;

  workerProc = spawn(tsxBin, [workerEntry], {
    env: {
      ...process.env,
      DATABASE_URL: env.DATABASE_URL,
      REDIS_URL: env.REDIS_URL,
      STORAGE_DRIVER: 'fs',
      STORAGE_FS_DIR: storageDir,
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  const reg = await request(http)
    .post('/api/auth/register')
    .send({ email: 'render@example.com', password: 'render-pass-123', name: 'Render' })
    .expect(201);
  token = reg.body.accessToken;
  const ws = await request(http)
    .post('/api/workspaces')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Рендер-студия' })
    .expect(201);
  workspaceId = ws.body.id;

  const project = await request(http)
    .post(`/api/workspaces/${workspaceId}/projects`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Ролик из трёх сцен', aspectRatio: '16:9', defaultLanguage: 'ru' })
    .expect(201);
  projectId = project.body.id;

  const scripts = [
    'Добро пожаловать в AvatarStudio. [pause:0.5s] Начнём знакомство. [gesture:open-hands]',
    'Вторая сцена рассказывает про [emphasis]ключевые[/emphasis] возможности платформы.',
    'И финальная сцена. [pause:0.5s] Спасибо за внимание! [gesture:nod]',
  ];
  for (const [i, script] of scripts.entries()) {
    await request(http)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/scenes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        script,
        avatarId: 'stock-01',
        voiceId: 'mock-ru-1',
        background: { type: 'color', color: i === 1 ? '#12343b' : '#1a1a2e' },
        layers: [{ type: 'text', zIndex: 1, props: { text: `Сцена ${i + 1}`, x: 0.05, y: 0.08 } }],
      })
      .expect(201);
  }
}, 120_000);

afterAll(async () => {
  workerProc?.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 500));
  await app?.close();
  await pool?.end();
  rmSync(storageDir, { recursive: true, force: true });
});

describe('Этап 4: пайплайн рендера', () => {
  let firstJobId = '';
  let balanceBefore = 0;

  it('рендерит проект из 3 сцен в связный MP4 с субтитрами', async () => {
    balanceBefore = await balance();
    const res = await request(http)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/renders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quality: '720p' })
      .expect(201);
    firstJobId = res.body.jobId;
    expect(res.body.creditsReserved).toBeGreaterThan(0);
    expect(await balance()).toBeCloseTo(balanceBefore - res.body.creditsReserved, 2);

    // WebSocket-прогресс
    const wsEvents: Array<{ stage: string }> = [];
    const socket = new WebSocket(`${baseUrl.replace('http', 'ws')}/api/ws?token=${token}`);
    await new Promise<void>((resolve, reject) => {
      socket.on('open', () => {
        socket.send(JSON.stringify({ type: 'subscribe', jobId: firstJobId }));
        resolve();
      });
      socket.on('error', reject);
    });
    socket.on('message', (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.stage) wsEvents.push(msg);
    });

    const job = await pollJob(firstJobId, ['done', 'failed']);
    socket.close();
    expect(job.status).toBe('done');
    expect(job.meta).toMatchObject({ scenes: 3, cacheHits: 0, rendered: 3 });
    expect(job.durationMs).toBeGreaterThan(3000);
    expect(job.outputUrl).toBeTruthy();

    // Скачиваем и проверяем контейнер: видео + аудио
    const downloadPath = new URL(job.outputUrl).pathname;
    const file = await request(http).get(downloadPath).expect(200);
    const mp4 = path.join(storageDir, 'final-check.mp4');
    writeFileSync(mp4, file.body as Buffer);
    const probe = spawnSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'stream=codec_type',
      '-of', 'csv=p=0',
      mp4,
    ]);
    const streams = probe.stdout.toString().trim().split('\n');
    expect(streams).toContain('video');
    expect(streams).toContain('audio');

    // Кредиты: списано по факту, статусные события в БД
    expect(Number(job.creditsCharged)).toBeGreaterThan(0);
    const events = await request(http)
      .get(`/api/workspaces/${workspaceId}/renders/${firstJobId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const stages = events.body.map((e: { stage: string }) => e.stage);
    for (const s of ['queued', 'preprocessing', 'tts', 'lipsync', 'compositing', 'encoding', 'done']) {
      expect(stages, `нет стадии ${s}`).toContain(s);
    }
    expect(wsEvents.length).toBeGreaterThan(0);
  }, 120_000);

  it('повторный рендер без правок = 0 работы воркеров (все сцены из кэша)', async () => {
    const res = await request(http)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/renders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quality: '720p' })
      .expect(201);
    const job = await pollJob(res.body.jobId, ['done', 'failed']);
    expect(job.status).toBe('done');
    expect(job.meta).toMatchObject({ scenes: 3, cacheHits: 3, rendered: 0 });

    // Ни одного нового сегмента и ни одной TTS-стадии
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM scene_render_cache');
    expect(rows[0].n).toBe(3);
    const events = await request(http)
      .get(`/api/workspaces/${workspaceId}/renders/${res.body.jobId}/events`)
      .set('Authorization', `Bearer ${token}`);
    const stages = events.body.map((e: { stage: string }) => e.stage);
    expect(stages).not.toContain('tts');
    expect(stages).not.toContain('lipsync');
  }, 120_000);

  it('правка 1 сцены из 3 → пересчёт ровно одной сцены', async () => {
    const project = await request(http)
      .get(`/api/workspaces/${workspaceId}/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`);
    const scene = project.body.scenes[1];
    await request(http)
      .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/scenes/${scene.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: scene.version, script: 'Обновлённая вторая сцена с новым текстом.' })
      .expect(200);

    const res = await request(http)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/renders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quality: '720p' })
      .expect(201);
    const job = await pollJob(res.body.jobId, ['done', 'failed']);
    expect(job.status).toBe('done');
    expect(job.meta).toMatchObject({ scenes: 3, cacheHits: 2, rendered: 1 });
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM scene_render_cache');
    expect(rows[0].n).toBe(4);
  }, 120_000);

  it('отмена возвращает кредиты (в т.ч. при гонке с уже начавшимся рендером)', async () => {
    const before = await balance();
    const res = await request(http)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/renders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quality: '1080p' })
      .expect(201);
    expect(await balance()).toBeCloseTo(before - res.body.creditsReserved, 2);

    const cancel = await request(http)
      .post(`/api/workspaces/${workspaceId}/renders/${res.body.jobId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(cancel.body.cancelled).toBe(true);
    expect(await balance()).toBeCloseTo(before, 2);

    // Статус остаётся cancelled, даже если воркер уже взял джоб в работу
    const job = await pollJob(res.body.jobId, ['cancelled'], 30_000);
    expect(job.status).toBe('cancelled');
    await new Promise((r) => setTimeout(r, 1500));
    const after = await request(http)
      .get(`/api/workspaces/${workspaceId}/renders/${res.body.jobId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(after.body.status).toBe('cancelled');
    expect(after.body.creditsCharged).toBe('0.00');
  }, 60_000);

  it('недостаточно кредитов → 402 с подсказкой, джоб не создаётся', async () => {
    await pool.query('UPDATE workspaces SET credits_balance = 0 WHERE id = $1', [workspaceId]);
    const res = await request(http)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/renders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quality: '1080p' })
      .expect(402);
    expect(res.body.error.code).toBe('INSUFFICIENT_CREDITS');
    expect(res.body.error.message).toMatch(/Пополните баланс/);
    await pool.query('UPDATE workspaces SET credits_balance = 10 WHERE id = $1', [workspaceId]);
  });

  it('битая разметка отклоняется до списания кредитов', async () => {
    const project = await request(http)
      .get(`/api/workspaces/${workspaceId}/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`);
    const scene = project.body.scenes[0];
    await request(http)
      .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/scenes/${scene.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: scene.version, script: 'Текст [rate:0.9]без закрытия' })
      .expect(200);
    const before = await balance();
    const res = await request(http)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/renders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quality: '720p' })
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_SCRIPT');
    expect(res.body.error.message).toMatch(/Сцена 1/);
    expect(await balance()).toBe(before);
  });
});
