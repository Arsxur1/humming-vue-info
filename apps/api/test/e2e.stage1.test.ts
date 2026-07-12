/**
 * E2E Этапа 1 (критерий «Готово, когда» из docs/PLAN.md):
 * регистрация → создание workspace → приглашение → проверка запрета действия для Viewer.
 * Требует PostgreSQL по DATABASE_URL (локально: docker compose up -d postgres).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import pg from 'pg';
import { loadEnv } from '@avatarstudio/shared';
import { AppModule } from '../src/app.module.js';
import { runMigrations } from '../src/db/migrate.js';

const env = loadEnv();

let app: INestApplication;
let http: ReturnType<INestApplication['getHttpServer']>;
let pool: pg.Pool;

beforeAll(async () => {
  await runMigrations(env.DATABASE_URL);
  pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  await pool.query(
    'TRUNCATE users, email_verifications, refresh_tokens, workspaces, workspace_members, invitations, audit_log RESTART IDENTITY CASCADE',
  );

  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  await app.init();
  http = app.getHttpServer();
}, 60_000);

afterAll(async () => {
  await app?.close();
  await pool?.end();
});

describe('Этап 1: auth + workspaces + RBAC', () => {
  const owner = { email: 'owner@example.com', password: 'owner-pass-123', name: 'Owner' };
  const viewer = { email: 'viewer@example.com', password: 'viewer-pass-123', name: 'Viewer' };
  let ownerToken = '';
  let viewerToken = '';
  let workspaceId = '';

  it('регистрирует владельца и выдаёт токены', async () => {
    const res = await request(http).post('/api/auth/register').send(owner).expect(201);
    expect(res.body.user.email).toBe(owner.email);
    expect(res.body.user.emailVerified).toBe(false);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    ownerToken = res.body.accessToken;
  });

  it('отклоняет повторную регистрацию с человекочитаемой ошибкой', async () => {
    const res = await request(http).post('/api/auth/register').send(owner).expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
    expect(res.body.error.message).toMatch(/уже зарегистрирован/);
  });

  it('подтверждает e-mail по токену из письма (заглушка-логгер)', async () => {
    const { rows } = await pool.query(
      'SELECT ev.token FROM email_verifications ev JOIN users u ON u.id = ev.user_id WHERE u.email = $1',
      [owner.email],
    );
    const token = rows[0].token as string;
    await request(http).post('/api/auth/verify-email').send({ token }).expect(200);
    const me = await request(http)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(me.body.emailVerified).toBe(true);
  });

  it('логин работает, refresh ротируется', async () => {
    const login = await request(http)
      .post('/api/auth/login')
      .send({ email: owner.email, password: owner.password })
      .expect(200);
    const refreshed = await request(http)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    // Старый refresh отозван ротацией
    await request(http)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });

  it('неверный пароль → 401 с подсказкой', async () => {
    const res = await request(http)
      .post('/api/auth/login')
      .send({ email: owner.email, password: 'wrong-password' })
      .expect(401);
    expect(res.body.error.message).toMatch(/Проверьте данные/);
  });

  it('создаёт workspace; создатель становится owner', async () => {
    const res = await request(http)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Моя студия' })
      .expect(201);
    workspaceId = res.body.id;

    const list = await request(http)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].role).toBe('owner');
  });

  it('без токена доступ к workspace закрыт (401)', async () => {
    await request(http).get('/api/workspaces').expect(401);
  });

  it('owner приглашает viewer-а', async () => {
    const res = await request(http)
      .post(`/api/workspaces/${workspaceId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: viewer.email, role: 'viewer' })
      .expect(201);
    expect(res.body.role).toBe('viewer');
  });

  it('приглашённый регистрируется и принимает приглашение', async () => {
    const reg = await request(http).post('/api/auth/register').send(viewer).expect(201);
    viewerToken = reg.body.accessToken;

    const { rows } = await pool.query('SELECT token FROM invitations WHERE email = $1', [
      viewer.email,
    ]);
    const inviteToken = rows[0].token as string;

    const res = await request(http)
      .post('/api/auth/invitations/accept')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ token: inviteToken })
      .expect(200);
    expect(res.body).toEqual({ workspaceId, role: 'viewer' });
  });

  it('ГЛАВНАЯ ПРОВЕРКА: viewer не может переименовать workspace (403)', async () => {
    const res = await request(http)
      .patch(`/api/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Взломанное имя' })
      .expect(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
    expect(res.body.error.message).toMatch(/viewer/);
  });

  it('viewer не может приглашать участников (403)', async () => {
    await request(http)
      .post(`/api/workspaces/${workspaceId}/invitations`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ email: 'third@example.com', role: 'viewer' })
      .expect(403);
  });

  it('viewer может смотреть участников (members.view)', async () => {
    const res = await request(http)
      .get(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(res.body).toHaveLength(2);
  });

  it('audit-log доступен owner-у и содержит ключевые события', async () => {
    const res = await request(http)
      .get(`/api/workspaces/${workspaceId}/audit-log`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const actions = res.body.map((e: { action: string }) => e.action);
    expect(actions).toContain('workspace.created');
    expect(actions).toContain('member.invited');
    expect(actions).toContain('member.joined');
  });

  it('audit-log закрыт для viewer-а (403)', async () => {
    await request(http)
      .get(`/api/workspaces/${workspaceId}/audit-log`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);
  });

  it('audit_log append-only: UPDATE запрещён на уровне БД', async () => {
    await expect(pool.query(`UPDATE audit_log SET action = 'tampered'`)).rejects.toThrow(
      /append-only/,
    );
    await expect(pool.query('DELETE FROM audit_log')).rejects.toThrow(/append-only/);
  });

  it('чужой пользователь (не участник) получает 403 на workspace', async () => {
    const stranger = await request(http)
      .post('/api/auth/register')
      .send({ email: 'stranger@example.com', password: 'stranger-123', name: 'Stranger' })
      .expect(201);
    const res = await request(http)
      .get(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${stranger.body.accessToken}`)
      .expect(403);
    expect(res.body.error.code).toBe('NOT_A_MEMBER');
  });
});
