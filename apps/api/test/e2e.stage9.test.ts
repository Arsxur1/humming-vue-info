/**
 * E2E Этапа 9: шаблоны с плейсхолдерами {{var}}, сохранение проекта как
 * шаблона, инстанцирование с подстановкой переменных, сиды стоковых шаблонов.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import pg from 'pg';
import { loadEnv } from '@avatarstudio/shared';
import { createDb } from '@avatarstudio/db';
import { AppModule } from '../src/app.module.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedGlobalTemplates } from '../src/templates/templates.service.js';

const env = loadEnv();

let app: INestApplication;
let http: ReturnType<INestApplication['getHttpServer']>;
let pool: pg.Pool;
let token = '';
let workspaceId = '';

const auth = () => `Bearer ${token}`;

beforeAll(async () => {
  await runMigrations(env.DATABASE_URL);
  pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  await pool.query(
    'TRUNCATE users, email_verifications, refresh_tokens, workspaces, workspace_members, invitations, audit_log, projects, scenes, layers, project_versions, assets, render_jobs, render_job_events, scene_render_cache, credit_transactions, moderation_cases, share_links, generation_registry, templates RESTART IDENTITY CASCADE',
  );
  const { db, pool: seedPool } = createDb(env.DATABASE_URL);
  const seeded = await seedGlobalTemplates(db);
  expect(seeded).toBeGreaterThanOrEqual(12);
  // повторный запуск — идемпотентен
  expect(await seedGlobalTemplates(db)).toBe(0);
  await seedPool.end();

  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  await app.init();
  http = app.getHttpServer();

  const reg = await request(http)
    .post('/api/auth/register')
    .send({ email: 'tpl@example.com', password: 'tpl-pass-12345', name: 'Tpl' })
    .expect(201);
  token = reg.body.accessToken;
  const ws = await request(http)
    .post('/api/workspaces')
    .set('Authorization', auth())
    .send({ name: 'Шаблонная' })
    .expect(201);
  workspaceId = ws.body.id;
}, 60_000);

afterAll(async () => {
  await app?.close();
  await pool?.end();
});

describe('Этап 9: шаблоны', () => {
  let projectFromTemplateId = '';

  it('список: ≥12 стоковых шаблонов с плейсхолдерами и категориями', async () => {
    const res = await request(http)
      .get(`/api/workspaces/${workspaceId}/templates`)
      .set('Authorization', auth())
      .expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(12);
    const sales = res.body.find(
      (t: { name: string }) => t.name === 'Персональное видео для лида',
    );
    expect(sales.isStock).toBe(true);
    expect(sales.placeholders).toEqual(
      expect.arrayContaining(['first_name', 'company', 'product', 'sender_name', 'value_prop']),
    );
  });

  it('инстанцирование: переменные подставляются в скрипты сцен', async () => {
    const list = await request(http)
      .get(`/api/workspaces/${workspaceId}/templates`)
      .set('Authorization', auth());
    const template = list.body.find(
      (t: { name: string }) => t.name === 'Персональное видео для лида',
    );

    const res = await request(http)
      .post(`/api/workspaces/${workspaceId}/templates/${template.id}/instantiate`)
      .set('Authorization', auth())
      .send({
        title: 'Видео для Анны',
        variables: {
          first_name: 'Анна',
          company: 'АО Ромашка',
          product: 'AvatarStudio',
          sender_name: 'Иван',
          value_prop: 'сократить затраты на видео втрое',
        },
      })
      .expect(201);
    projectFromTemplateId = res.body.projectId;

    const project = await request(http)
      .get(`/api/workspaces/${workspaceId}/projects/${projectFromTemplateId}`)
      .set('Authorization', auth())
      .expect(200);
    expect(project.body.scenes).toHaveLength(2);
    expect(project.body.scenes[0].script).toContain('Анна');
    expect(project.body.scenes[0].script).toContain('АО Ромашка');
    expect(project.body.scenes[0].script).not.toContain('{{');
    // Director Markup из шаблона сохранился
    expect(project.body.scenes[0].script).toContain('[gesture:open-hands]');
    expect(project.body.scenes[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('незаполненные переменные → 400 с перечнем', async () => {
    const list = await request(http)
      .get(`/api/workspaces/${workspaceId}/templates`)
      .set('Authorization', auth());
    const template = list.body.find(
      (t: { name: string }) => t.name === 'Персональное видео для лида',
    );
    const res = await request(http)
      .post(`/api/workspaces/${workspaceId}/templates/${template.id}/instantiate`)
      .set('Authorization', auth())
      .send({ variables: { first_name: 'Анна' } })
      .expect(400);
    expect(res.body.error.code).toBe('MISSING_VARIABLES');
    expect(res.body.error.message).toContain('{{company}}');
  });

  it('сохранение проекта как шаблона workspace (FR-6.3) и создание из него', async () => {
    const created = await request(http)
      .post(`/api/workspaces/${workspaceId}/templates`)
      .set('Authorization', auth())
      .send({
        projectId: projectFromTemplateId,
        name: 'Мой шаблон продаж',
        category: 'sales',
        description: 'на основе видео для Анны',
      })
      .expect(201);
    expect(created.body.placeholders).toEqual([]); // переменные уже подставлены

    const list = await request(http)
      .get(`/api/workspaces/${workspaceId}/templates`)
      .set('Authorization', auth());
    const mine = list.body.find((t: { name: string }) => t.name === 'Мой шаблон продаж');
    expect(mine.isStock).toBe(false);

    const inst = await request(http)
      .post(`/api/workspaces/${workspaceId}/templates/${mine.id}/instantiate`)
      .set('Authorization', auth())
      .send({ variables: {} })
      .expect(201);
    const project = await request(http)
      .get(`/api/workspaces/${workspaceId}/projects/${inst.body.projectId}`)
      .set('Authorization', auth());
    expect(project.body.scenes).toHaveLength(2);
  });

  it('стоковый шаблон удалить нельзя, свой — можно', async () => {
    const list = await request(http)
      .get(`/api/workspaces/${workspaceId}/templates`)
      .set('Authorization', auth());
    const stock = list.body.find((t: { isStock: boolean }) => t.isStock);
    await request(http)
      .delete(`/api/workspaces/${workspaceId}/templates/${stock.id}`)
      .set('Authorization', auth())
      .expect(404);
    const mine = list.body.find((t: { name: string }) => t.name === 'Мой шаблон продаж');
    await request(http)
      .delete(`/api/workspaces/${workspaceId}/templates/${mine.id}`)
      .set('Authorization', auth())
      .expect(200);
  });

  it('viewer не может создавать шаблоны и проекты из них (403)', async () => {
    await request(http)
      .post(`/api/workspaces/${workspaceId}/invitations`)
      .set('Authorization', auth())
      .send({ email: 'tplviewer@example.com', role: 'viewer' })
      .expect(201);
    const reg = await request(http)
      .post('/api/auth/register')
      .send({ email: 'tplviewer@example.com', password: 'viewer-pass-123', name: 'V' })
      .expect(201);
    const { rows } = await pool.query(
      "SELECT token FROM invitations WHERE email = 'tplviewer@example.com'",
    );
    await request(http)
      .post('/api/auth/invitations/accept')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .send({ token: rows[0].token })
      .expect(200);

    const list = await request(http)
      .get(`/api/workspaces/${workspaceId}/templates`)
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .expect(200); // смотреть можно
    await request(http)
      .post(`/api/workspaces/${workspaceId}/templates/${list.body[0].id}/instantiate`)
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .send({ variables: {} })
      .expect(403);
  });
});
