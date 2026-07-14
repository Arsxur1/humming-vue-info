/**
 * E2E боевой готовности авторизации:
 * — сброс пароля по токену из письма (со сбросом всех сессий);
 * — 2FA (TOTP): setup → enable → логин требует код → disable;
 * — rate limiting: превышение лимита даёт 429 с Retry-After.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import pg from 'pg';
import IORedis from 'ioredis';
import { loadEnv } from '@avatarstudio/shared';
import { AppModule } from '../src/app.module.js';
import { runMigrations } from '../src/db/migrate.js';
import { totpNow } from '../src/auth/totp.js';

const env = loadEnv();

let app: INestApplication;
let http: ReturnType<INestApplication['getHttpServer']>;
let pool: pg.Pool;
let redis: IORedis;

async function resetTokenFor(email: string): Promise<string> {
  // Токен приходит письмом; в dev письма также попадают в MailerService.sent,
  // но проще прочитать сырой токен из письма через лог невозможно — берём из БД
  // нельзя (храним только хеш). Поэтому достаём из MailerService напрямую.
  const mailer = app.get<{ sent: Array<{ to: string; body: string }> }>(
    (await import('../src/mailer/mailer.service.js')).MailerService,
  );
  const mail = [...mailer.sent].reverse().find((m) => m.to === email && m.body.includes('сброс'));
  if (!mail) throw new Error('письмо сброса не найдено');
  return mail.body.match(/сброса пароля[^:]*:\s*(\S+)/)![1]!;
}

beforeAll(async () => {
  await runMigrations(env.DATABASE_URL);
  pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  await pool.query(
    'TRUNCATE users, email_verifications, refresh_tokens, password_resets, workspaces, workspace_members, audit_log RESTART IDENTITY CASCADE',
  );
  redis = new IORedis(env.REDIS_URL);
  // Изоляция от прошлых прогонов: rate-limit счётчики живут в Redis с TTL
  const stale = await redis.keys('ratelimit:*');
  if (stale.length) await redis.del(...stale);

  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  await app.init();
  http = app.getHttpServer();
}, 60_000);

afterAll(async () => {
  await app?.close();
  await pool?.end();
  redis?.disconnect();
});

describe('Сброс пароля', () => {
  const email = 'reset@example.com';
  const oldPass = 'old-password-123';
  const newPass = 'new-password-456';
  let oldRefresh = '';

  it('регистрация', async () => {
    const res = await request(http)
      .post('/api/auth/register')
      .send({ email, password: oldPass, name: 'Reset' })
      .expect(201);
    oldRefresh = res.body.refreshToken;
    expect(res.body.user.twoFactorEnabled).toBe(false);
  });

  it('forgot возвращает 200 даже для несуществующего e-mail (без раскрытия)', async () => {
    await request(http)
      .post('/api/auth/password/forgot')
      .send({ email: 'nobody@example.com' })
      .expect(200);
  });

  it('сброс по токену: новый пароль работает, старый — нет, сессии сброшены', async () => {
    await request(http).post('/api/auth/password/forgot').send({ email }).expect(200);
    const token = await resetTokenFor(email);

    await request(http)
      .post('/api/auth/password/reset')
      .send({ token, newPassword: newPass })
      .expect(200);

    // старый пароль больше не подходит
    await request(http)
      .post('/api/auth/login')
      .send({ email, password: oldPass })
      .expect(401);
    // новый — подходит
    await request(http)
      .post('/api/auth/login')
      .send({ email, password: newPass })
      .expect(200);
    // старый refresh-токен отозван при сбросе
    await request(http)
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(401);
  });

  it('повторное использование токена сброса отклоняется', async () => {
    await request(http).post('/api/auth/password/forgot').send({ email }).expect(200);
    const token = await resetTokenFor(email);
    await request(http)
      .post('/api/auth/password/reset')
      .send({ token, newPassword: 'another-pass-789' })
      .expect(200);
    await request(http)
      .post('/api/auth/password/reset')
      .send({ token, newPassword: 'yet-another-000' })
      .expect(400);
  });
});

describe('2FA (TOTP)', () => {
  const email = '2fa@example.com';
  const pass = 'twofa-password-123';
  let accessToken = '';
  let secret = '';

  it('регистрация и настройка 2FA', async () => {
    const reg = await request(http)
      .post('/api/auth/register')
      .send({ email, password: pass, name: '2FA' })
      .expect(201);
    accessToken = reg.body.accessToken;

    const setup = await request(http)
      .post('/api/auth/2fa/setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    expect(setup.body.otpauthUri).toContain('otpauth://totp/');
    secret = setup.body.secret;
  });

  it('неверный код при включении отклоняется, верный — включает', async () => {
    await request(http)
      .post('/api/auth/2fa/enable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: '000000' })
      .expect(400);

    await request(http)
      .post('/api/auth/2fa/enable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: totpNow(secret) })
      .expect(200);

    const me = await request(http)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.twoFactorEnabled).toBe(true);
  });

  it('логин без кода → 401 TWO_FACTOR_REQUIRED', async () => {
    const res = await request(http)
      .post('/api/auth/login')
      .send({ email, password: pass })
      .expect(401);
    expect(res.body.error.code).toBe('TWO_FACTOR_REQUIRED');
  });

  it('логин с неверным кодом → 401, с верным → 200', async () => {
    const bad = await request(http)
      .post('/api/auth/login')
      .send({ email, password: pass, totp: '123456' })
      .expect(401);
    expect(bad.body.error.code).toBe('INVALID_2FA_CODE');

    await request(http)
      .post('/api/auth/login')
      .send({ email, password: pass, totp: totpNow(secret) })
      .expect(200);
  });

  it('отключение 2FA возвращает обычный вход', async () => {
    await request(http)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: totpNow(secret) })
      .expect(200);
    await request(http).post('/api/auth/login').send({ email, password: pass }).expect(200);
  });
});

describe('Rate limiting', () => {
  it('превышение лимита forgot-password → 429 с Retry-After', async () => {
    // чистим счётчики, чтобы предыдущие тесты не влияли
    const keys = await redis.keys('ratelimit:*');
    if (keys.length) await redis.del(...keys);

    // лимит forgot — 5 за окно; 6-й запрос должен быть заблокирован
    let blocked: request.Response | null = null;
    for (let i = 0; i < 6; i++) {
      const res = await request(http)
        .post('/api/auth/password/forgot')
        .send({ email: 'ratelimit@example.com' });
      if (res.status === 429) blocked = res;
    }
    expect(blocked).not.toBeNull();
    expect(blocked!.body.error.code).toBe('RATE_LIMITED');
    expect(blocked!.headers['retry-after']).toBeDefined();
  });
});
