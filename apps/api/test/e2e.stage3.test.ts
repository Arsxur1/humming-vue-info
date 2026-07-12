/**
 * Интеграционный тест Этапа 3 (критерий из docs/PLAN.md):
 * создать проект из 20 сцен, править (с оптимистической блокировкой),
 * откатить версию. Плюс цикл ассета: presigned upload → антивирус → превью.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import pg from 'pg';
import { loadEnv } from '@avatarstudio/shared';
import { AppModule } from '../src/app.module.js';
import { runMigrations } from '../src/db/migrate.js';

const storageDir = mkdtempSync(path.join(tmpdir(), 'avatarstudio-storage-'));
process.env.STORAGE_DRIVER = 'fs';
process.env.STORAGE_FS_DIR = storageDir;

const env = loadEnv();

let app: INestApplication;
let http: ReturnType<INestApplication['getHttpServer']>;
let pool: pg.Pool;
let token = '';
let workspaceId = '';
let projectId = '';

// 1x1 красный PNG
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

beforeAll(async () => {
  await runMigrations(env.DATABASE_URL);
  pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  await pool.query(
    'TRUNCATE users, email_verifications, refresh_tokens, workspaces, workspace_members, invitations, audit_log, projects, scenes, layers, project_versions, assets RESTART IDENTITY CASCADE',
  );

  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.use('/api/uploads', express.raw({ type: '*/*', limit: '500mb' }));
  await app.init();
  http = app.getHttpServer();

  const reg = await request(http)
    .post('/api/auth/register')
    .send({ email: 'editor@example.com', password: 'editor-pass-123', name: 'Editor' })
    .expect(201);
  token = reg.body.accessToken;
  const ws = await request(http)
    .post('/api/workspaces')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Студия' })
    .expect(201);
  workspaceId = ws.body.id;
}, 60_000);

afterAll(async () => {
  await app?.close();
  await pool?.end();
  rmSync(storageDir, { recursive: true, force: true });
});

const auth = () => `Bearer ${token}`;

describe('Этап 3: проект из 20 сцен, правки, версии', () => {
  it('создаёт проект и 20 сцен', async () => {
    const res = await request(http)
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Authorization', auth())
      .send({ title: 'Курс: онбординг', aspectRatio: '16:9', defaultLanguage: 'ru' })
      .expect(201);
    projectId = res.body.id;

    for (let i = 0; i < 20; i++) {
      await request(http)
        .post(`/api/workspaces/${workspaceId}/projects/${projectId}/scenes`)
        .set('Authorization', auth())
        .send({
          script: `Сцена ${i + 1}. [pause:0.5s] Текст сцены.`,
          layers: [{ type: 'text', zIndex: 1, props: { text: `Заголовок ${i + 1}` } }],
        })
        .expect(201);
    }

    const project = await request(http)
      .get(`/api/workspaces/${workspaceId}/projects/${projectId}`)
      .set('Authorization', auth())
      .expect(200);
    expect(project.body.scenes).toHaveLength(20);
    expect(project.body.scenes[0].layers).toHaveLength(1);
    expect(project.body.scenes[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('правит сцену с оптимистической блокировкой; конфликт версий → 409', async () => {
    const project = await request(http)
      .get(`/api/workspaces/${workspaceId}/projects/${projectId}`)
      .set('Authorization', auth())
      .expect(200);
    const scene = project.body.scenes[0];
    const hashBefore = scene.contentHash;

    const updated = await request(http)
      .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/scenes/${scene.id}`)
      .set('Authorization', auth())
      .send({ expectedVersion: scene.version, script: 'Новый текст первой сцены.' })
      .expect(200);
    expect(updated.body.version).toBe(scene.version + 1);
    expect(updated.body.contentHash).not.toBe(hashBefore);

    // Вторая вкладка с устаревшей версией
    const conflict = await request(http)
      .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/scenes/${scene.id}`)
      .set('Authorization', auth())
      .send({ expectedVersion: scene.version, script: 'Правка из другой вкладки' })
      .expect(409);
    expect(conflict.body.error.code).toBe('VERSION_CONFLICT');
    expect(conflict.body.error.message).toMatch(/другой вкладке/);
  });

  it('снимает версию, правит дальше, diff показывает изменённые сцены', async () => {
    const snap = await request(http)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/versions`)
      .set('Authorization', auth())
      .expect(201);
    const versionId = snap.body.id;

    const project = await request(http)
      .get(`/api/workspaces/${workspaceId}/projects/${projectId}`)
      .set('Authorization', auth());
    const target = project.body.scenes[5];
    await request(http)
      .patch(`/api/workspaces/${workspaceId}/projects/${projectId}/scenes/${target.id}`)
      .set('Authorization', auth())
      .send({ expectedVersion: target.version, script: 'Отредактированная шестая сцена' })
      .expect(200);
    await request(http)
      .patch(`/api/workspaces/${workspaceId}/projects/${projectId}`)
      .set('Authorization', auth())
      .send({ title: 'Курс: онбординг v2' })
      .expect(200);

    const diff = await request(http)
      .get(
        `/api/workspaces/${workspaceId}/projects/${projectId}/versions/${versionId}/diff`,
      )
      .set('Authorization', auth())
      .expect(200);
    expect(diff.body.changedScenes).toEqual([target.id]);
    expect(diff.body.addedScenes).toEqual([]);
    expect(diff.body.removedScenes).toEqual([]);
    expect(diff.body.titleChanged).toEqual({
      from: 'Курс: онбординг',
      to: 'Курс: онбординг v2',
    });
  });

  it('откатывает версию: скрипт и заголовок возвращаются', async () => {
    const versions = await request(http)
      .get(`/api/workspaces/${workspaceId}/projects/${projectId}/versions`)
      .set('Authorization', auth())
      .expect(200);
    // последний созданный вручную снимок (до правок) — сейчас единственный
    const versionId = versions.body[versions.body.length - 1].id;

    await request(http)
      .post(
        `/api/workspaces/${workspaceId}/projects/${projectId}/versions/${versionId}/restore`,
      )
      .set('Authorization', auth())
      .expect(200);

    const project = await request(http)
      .get(`/api/workspaces/${workspaceId}/projects/${projectId}`)
      .set('Authorization', auth())
      .expect(200);
    expect(project.body.title).toBe('Курс: онбординг');
    expect(project.body.scenes).toHaveLength(20);
    const scene5 = project.body.scenes.find(
      (s: { orderIndex: number }) => s.orderIndex === 5,
    );
    expect(scene5.script).not.toBe('Отредактированная шестая сцена');
    // перед откатом снят автоснимок — история не потеряна
    const after = await request(http)
      .get(`/api/workspaces/${workspaceId}/projects/${projectId}/versions`)
      .set('Authorization', auth());
    expect(after.body.some((v: { label: string | null }) => v.label?.includes('перед откатом'))).toBe(
      true,
    );
  });

  it('reorder меняет порядок сцен', async () => {
    const project = await request(http)
      .get(`/api/workspaces/${workspaceId}/projects/${projectId}`)
      .set('Authorization', auth());
    const ids = project.body.scenes.map((s: { id: string }) => s.id);
    const reversed = [...ids].reverse();
    await request(http)
      .post(`/api/workspaces/${workspaceId}/projects/${projectId}/scenes/reorder`)
      .set('Authorization', auth())
      .send({ sceneIds: reversed })
      .expect(200);
    const after = await request(http)
      .get(`/api/workspaces/${workspaceId}/projects/${projectId}`)
      .set('Authorization', auth());
    expect(after.body.scenes.map((s: { id: string }) => s.id)).toEqual(reversed);
  });
});

describe('Этап 3: ассеты — presigned upload, антивирус-заглушка, превью', () => {
  it('полный цикл: запрос → PUT по presigned URL → complete → clean + превью', async () => {
    const req = await request(http)
      .post(`/api/workspaces/${workspaceId}/assets/uploads`)
      .set('Authorization', auth())
      .send({ fileName: 'logo.png', mime: 'image/png', sizeBytes: PNG_1PX.length })
      .expect(201);
    const { assetId, upload } = req.body;
    expect(upload.method).toBe('PUT');

    // PUT по «presigned» URL (fs-драйвер → наш /api/uploads/:token)
    const uploadPath = new URL(upload.url).pathname;
    await request(http)
      .put(uploadPath)
      .set('Content-Type', 'image/png')
      .send(PNG_1PX)
      .expect(200);

    const done = await request(http)
      .post(`/api/workspaces/${workspaceId}/assets/${assetId}/complete`)
      .set('Authorization', auth())
      .expect(201);
    expect(done.body.status).toBe('clean');
    expect(done.body.hasPreview).toBe(true); // ffmpeg сгенерировал превью
  });

  it('complete без загрузки файла → понятная ошибка', async () => {
    const req = await request(http)
      .post(`/api/workspaces/${workspaceId}/assets/uploads`)
      .set('Authorization', auth())
      .send({ fileName: 'ghost.png', mime: 'image/png', sizeBytes: 10 })
      .expect(201);
    const res = await request(http)
      .post(`/api/workspaces/${workspaceId}/assets/${req.body.assetId}/complete`)
      .set('Authorization', auth())
      .expect(400);
    expect(res.body.error.code).toBe('FILE_NOT_UPLOADED');
  });

  it('битый upload-токен отклоняется', async () => {
    await request(http)
      .put('/api/uploads/forged.token')
      .set('Content-Type', 'image/png')
      .send(PNG_1PX)
      .expect(400);
  });

  it('файл больше 500 МБ отклоняется на этапе запроса с подсказкой', async () => {
    const res = await request(http)
      .post(`/api/workspaces/${workspaceId}/assets/uploads`)
      .set('Authorization', auth())
      .send({ fileName: 'huge.mp4', mime: 'video/mp4', sizeBytes: 501 * 1024 * 1024 })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/500 МБ/);
  });
});
