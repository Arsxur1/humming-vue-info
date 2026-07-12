/**
 * E2E Этапа 5 (критерии из docs/PLAN.md):
 * — скрипт из стоп-листа не попадает в очередь;
 * — готовый MP4 содержит валидный C2PA-манифест (проверка c2pa-инструментом);
 * — шаринг по ссылке: public / password / members, TTL.
 */
import { spawn, type ChildProcess } from 'node:child_process';
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
import { createC2pa } from 'c2pa-node';
import { loadEnv } from '@avatarstudio/shared';
import { AppModule } from '../src/app.module.js';
import { runMigrations } from '../src/db/migrate.js';

const storageDir = mkdtempSync(path.join(tmpdir(), 'avatarstudio-stage5-'));
process.env.STORAGE_DRIVER = 'fs';
process.env.STORAGE_FS_DIR = storageDir;

const env = loadEnv();
const here = path.dirname(fileURLToPath(import.meta.url));
const tsxBin = path.resolve(here, '../node_modules/.bin/tsx');
const workerEntry = path.resolve(here, '../../worker/src/main.ts');

let app: INestApplication;
let http: ReturnType<INestApplication['getHttpServer']>;
let pool: pg.Pool;
let workerProc: ChildProcess;
let ownerToken = '';
let viewerToken = '';
let workspaceId = '';
let projectId = '';

const authed = (t: string) => `Bearer ${t}`;

async function pollJob(jobId: string, until: string[], timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await request(http)
      .get(`/api/workspaces/${workspaceId}/renders/${jobId}`)
      .set('Authorization', authed(ownerToken))
      .expect(200);
    if (until.includes(res.body.status)) return res.body;
    if (Date.now() > deadline) throw new Error(`timeout: ${res.body.status}/${res.body.stage}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function setScript(index: number, script: string) {
  const project = await request(http)
    .get(`/api/workspaces/${workspaceId}/projects/${projectId}`)
    .set('Authorization', authed(ownerToken));
  const scene = project.body.scenes[index];
  await request(http)
    .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/scenes/${scene.id}`)
    .set('Authorization', authed(ownerToken))
    .send({ expectedVersion: scene.version, script })
    .expect(200);
}

beforeAll(async () => {
  await runMigrations(env.DATABASE_URL);
  pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  await pool.query(
    'TRUNCATE users, email_verifications, refresh_tokens, workspaces, workspace_members, invitations, audit_log, projects, scenes, layers, project_versions, assets, render_jobs, render_job_events, scene_render_cache, credit_transactions, moderation_cases, share_links, generation_registry RESTART IDENTITY CASCADE',
  );

  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.use('/api/uploads', express.raw({ type: '*/*', limit: '500mb' }));
  await app.listen(0);
  http = app.getHttpServer();

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
    .send({ email: 'owner5@example.com', password: 'owner5-pass-123', name: 'Owner' })
    .expect(201);
  ownerToken = reg.body.accessToken;
  const ws = await request(http)
    .post('/api/workspaces')
    .set('Authorization', authed(ownerToken))
    .send({ name: 'Студия Э5' })
    .expect(201);
  workspaceId = ws.body.id;

  // viewer для проверки members-ссылок
  await request(http)
    .post(`/api/workspaces/${workspaceId}/invitations`)
    .set('Authorization', authed(ownerToken))
    .send({ email: 'viewer5@example.com', role: 'viewer' })
    .expect(201);
  const regViewer = await request(http)
    .post('/api/auth/register')
    .send({ email: 'viewer5@example.com', password: 'viewer5-pass-123', name: 'Viewer' })
    .expect(201);
  viewerToken = regViewer.body.accessToken;
  const { rows } = await pool.query('SELECT token FROM invitations LIMIT 1');
  await request(http)
    .post('/api/auth/invitations/accept')
    .set('Authorization', authed(viewerToken))
    .send({ token: rows[0].token })
    .expect(200);

  const project = await request(http)
    .post(`/api/workspaces/${workspaceId}/projects`)
    .set('Authorization', authed(ownerToken))
    .send({ title: 'Проект Э5', aspectRatio: '16:9' })
    .expect(201);
  projectId = project.body.id;
  await request(http)
    .post(`/api/workspaces/${workspaceId}/projects/${projectId}/scenes`)
    .set('Authorization', authed(ownerToken))
    .send({ script: 'Обычный безобидный текст о продукте.' })
    .expect(201);
}, 120_000);

afterAll(async () => {
  workerProc?.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 500));
  await app?.close();
  await pool?.end();
  rmSync(storageDir, { recursive: true, force: true });
});

describe('Этап 5: модерация', () => {
  it('скрипт из стоп-листа (block) не попадает в очередь, кредиты целы', async () => {
    await setScript(0, 'Друзья, гарантированный доход без риска — жмите на ссылку!');
    const { rows: balBefore } = await pool.query(
      'SELECT credits_balance FROM workspaces WHERE id=$1', [workspaceId]);
    const res = await request(http)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/renders`)
      .set('Authorization', authed(ownerToken))
      .send({ quality: '720p' })
      .expect(403);
    expect(res.body.error.code).toBe('CONTENT_POLICY_VIOLATION');
    expect(res.body.error.message).toMatch(/нарушает правила/);
    const { rows: jobs } = await pool.query('SELECT count(*)::int AS n FROM render_jobs');
    expect(jobs[0].n).toBe(0);
    const { rows: balAfter } = await pool.query(
      'SELECT credits_balance FROM workspaces WHERE id=$1', [workspaceId]);
    expect(balAfter[0].credits_balance).toBe(balBefore[0].credits_balance);
  });

  it('review-термин → кейс в очереди; admin одобряет → рендер проходит', async () => {
    await setScript(0, 'Есть мнение: инвестируйте всё сегодня — расскажем почему в этом видео.');
    const first = await request(http)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/renders`)
      .set('Authorization', authed(ownerToken))
      .send({ quality: '720p' })
      .expect(403);
    expect(first.body.error.code).toBe('MODERATION_PENDING');

    // viewer не видит очередь модерации
    await request(http)
      .get(`/api/workspaces/${workspaceId}/moderation/cases`)
      .set('Authorization', authed(viewerToken))
      .expect(403);

    const cases = await request(http)
      .get(`/api/workspaces/${workspaceId}/moderation/cases?status=pending`)
      .set('Authorization', authed(ownerToken))
      .expect(200);
    expect(cases.body).toHaveLength(1);
    expect(cases.body[0].matchedTerm).toBe('инвестируйте всё сегодня');

    await request(http)
      .post(`/api/workspaces/${workspaceId}/moderation/cases/${cases.body[0].id}/resolve`)
      .set('Authorization', authed(ownerToken))
      .send({ decision: 'approve', note: 'образовательный контекст' })
      .expect(200);

    const retry = await request(http)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/renders`)
      .set('Authorization', authed(ownerToken))
      .send({ quality: '720p' })
      .expect(201);
    const job = await pollJob(retry.body.jobId, ['done', 'failed']);
    expect(job.status).toBe('done');
  }, 120_000);
});

describe('Этап 5: C2PA', () => {
  let outputUrl = '';
  let jobId = '';

  it('готовый MP4 содержит валидный C2PA-манифест (проверка c2pa-node)', async () => {
    await setScript(0, 'Финальный текст для проверки манифеста подлинности.');
    const res = await request(http)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/renders`)
      .set('Authorization', authed(ownerToken))
      .send({ quality: '720p' })
      .expect(201);
    jobId = res.body.jobId;
    const job = await pollJob(jobId, ['done', 'failed']);
    expect(job.status).toBe('done');
    outputUrl = job.outputUrl;

    const file = await request(http).get(new URL(outputUrl).pathname).expect(200);
    const mp4Path = path.join(storageDir, 'c2pa-check.mp4');
    writeFileSync(mp4Path, file.body as Buffer);

    const reader = createC2pa();
    const result = await reader.read({ path: mp4Path, mimeType: 'video/mp4' });
    expect(result).toBeTruthy();
    const manifest = result!.active_manifest;
    expect(manifest?.claim_generator).toMatch(/^AvatarStudio\//);
    const labels = (manifest?.assertions ?? []).map((a: { label: string }) => a.label);
    expect(labels).toContain('com.avatarstudio.generation');
    expect(labels).toContain('c2pa.actions');
    // маркировка синтетики
    expect(JSON.stringify(manifest)).toContain('trainedAlgorithmicMedia');
  }, 120_000);

  it('генерация записана в неизменяемый реестр; реестр append-only', async () => {
    const { rows } = await pool.query(
      'SELECT * FROM generation_registry WHERE job_id = $1', [jobId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].claim_generator).toMatch(/^AvatarStudio\//);
    await expect(pool.query('DELETE FROM generation_registry')).rejects.toThrow(/append-only/);
    await expect(
      pool.query(`UPDATE generation_registry SET script_hash = 'x'`),
    ).rejects.toThrow(/append-only/);
  });

  describe('шаринг по ссылке', () => {
    it('public: доступ без авторизации', async () => {
      const share = await request(http)
        .post(`/api/workspaces/${workspaceId}/renders/${jobId}/share`)
        .set('Authorization', authed(ownerToken))
        .send({ visibility: 'public' })
        .expect(201);
      const token = share.body.token;

      const info = await request(http).get(`/api/share/${token}`).expect(200);
      expect(info.body.requiresPassword).toBe(false);

      const access = await request(http).post(`/api/share/${token}/access`).send({}).expect(200);
      expect(access.body.downloadUrl).toBeTruthy();
      await request(http).get(new URL(access.body.downloadUrl).pathname).expect(200);
    });

    it('password: неверный пароль 403, верный — доступ', async () => {
      const share = await request(http)
        .post(`/api/workspaces/${workspaceId}/renders/${jobId}/share`)
        .set('Authorization', authed(ownerToken))
        .send({ visibility: 'password', password: 'secret42' })
        .expect(201);
      const token = share.body.token;
      await request(http).post(`/api/share/${token}/access`).send({ password: 'wrong' }).expect(403);
      await request(http)
        .post(`/api/share/${token}/access`)
        .send({ password: 'secret42' })
        .expect(200);
    });

    it('members: чужому 401/403, участнику — доступ', async () => {
      const share = await request(http)
        .post(`/api/workspaces/${workspaceId}/renders/${jobId}/share`)
        .set('Authorization', authed(ownerToken))
        .send({ visibility: 'members' })
        .expect(201);
      const token = share.body.token;
      await request(http).post(`/api/share/${token}/access`).send({}).expect(401);
      const stranger = await request(http)
        .post('/api/auth/register')
        .send({ email: 'stranger5@example.com', password: 'stranger-123', name: 'S' })
        .expect(201);
      await request(http)
        .post(`/api/share/${token}/access`)
        .set('Authorization', authed(stranger.body.accessToken))
        .send({})
        .expect(403);
      await request(http)
        .post(`/api/share/${token}/access`)
        .set('Authorization', authed(viewerToken))
        .send({})
        .expect(200);
    });

    it('истёкшая ссылка → 410 с подсказкой', async () => {
      const share = await request(http)
        .post(`/api/workspaces/${workspaceId}/renders/${jobId}/share`)
        .set('Authorization', authed(ownerToken))
        .send({ visibility: 'public', ttlHours: 1 })
        .expect(201);
      await pool.query('UPDATE share_links SET expires_at = now() - interval \'1 hour\' WHERE id = $1', [
        share.body.id,
      ]);
      const res = await request(http).post(`/api/share/${share.body.id ? share.body.token : ''}/access`).send({}).expect(410);
      expect(res.body.error.code).toBe('SHARE_EXPIRED');
    });

    it('отозванная ссылка перестаёт работать; viewer не может создавать ссылки', async () => {
      const share = await request(http)
        .post(`/api/workspaces/${workspaceId}/renders/${jobId}/share`)
        .set('Authorization', authed(ownerToken))
        .send({ visibility: 'public' })
        .expect(201);
      await request(http)
        .delete(`/api/workspaces/${workspaceId}/shares/${share.body.id}`)
        .set('Authorization', authed(ownerToken))
        .expect(200);
      await request(http).post(`/api/share/${share.body.token}/access`).send({}).expect(404);

      await request(http)
        .post(`/api/workspaces/${workspaceId}/renders/${jobId}/share`)
        .set('Authorization', authed(viewerToken))
        .send({ visibility: 'public' })
        .expect(403);
    });
  });
});
