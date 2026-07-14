import { describe, expect, it } from 'vitest';
import { DEV_JWT_SECRET, loadEnv } from '../src/env.js';

describe('loadEnv — защита production', () => {
  const base = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://u:p@db:5432/app',
    REDIS_URL: 'redis://redis:6379',
    API_PUBLIC_URL: 'https://api.example.com',
    WEB_ORIGIN: 'https://app.example.com',
  };

  it('падает, если в production оставлен dev-дефолт JWT_SECRET', () => {
    expect(() => loadEnv({ ...base, JWT_SECRET: DEV_JWT_SECRET })).toThrowError(/JWT_SECRET/);
  });

  it('падает и без явного JWT_SECRET (подставляется dev-дефолт)', () => {
    expect(() => loadEnv(base)).toThrowError(/JWT_SECRET/);
  });

  it('со своим секретом стартует', () => {
    const env = loadEnv({ ...base, JWT_SECRET: 'a-real-strong-secret-value-123456' });
    expect(env.NODE_ENV).toBe('production');
    expect(env.RATE_LIMIT_ENABLED).toBe(true);
  });

  it('в development dev-дефолт допустим', () => {
    const env = loadEnv({ NODE_ENV: 'development' });
    expect(env.JWT_SECRET).toBe(DEV_JWT_SECRET);
  });

  it('SMTP_SECURE и RATE_LIMIT_ENABLED приводятся к boolean', () => {
    const env = loadEnv({ SMTP_SECURE: 'true', RATE_LIMIT_ENABLED: 'false' });
    expect(env.SMTP_SECURE).toBe(true);
    expect(env.RATE_LIMIT_ENABLED).toBe(false);
  });
});
