import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';
import { isTerminalStatus, RENDER_STAGES } from '../src/render-job.js';

describe('loadEnv', () => {
  it('подставляет дефолты для локальной разработки', () => {
    const env = loadEnv({});
    expect(env.API_PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
    expect(env.REDIS_URL).toBe('redis://localhost:6379');
  });

  it('приводит строковый порт к числу', () => {
    const env = loadEnv({ API_PORT: '8080' });
    expect(env.API_PORT).toBe(8080);
  });

  it('падает с человекочитаемой ошибкой на битой конфигурации', () => {
    expect(() => loadEnv({ DATABASE_URL: 'not-a-url' })).toThrowError(
      /Некорректная конфигурация окружения:[\s\S]*DATABASE_URL/,
    );
  });
});

describe('render-job', () => {
  it('стадии идут в порядке FR-5.1', () => {
    expect(RENDER_STAGES).toEqual([
      'queued',
      'preprocessing',
      'tts',
      'lipsync',
      'compositing',
      'encoding',
    ]);
  });

  it('различает терминальные статусы', () => {
    expect(isTerminalStatus('done')).toBe(true);
    expect(isTerminalStatus('failed')).toBe(true);
    expect(isTerminalStatus('cancelled')).toBe(true);
    expect(isTerminalStatus('tts')).toBe(false);
  });
});
