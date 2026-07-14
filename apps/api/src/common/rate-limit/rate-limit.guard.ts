import {
  HttpException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Env } from '@avatarstudio/shared';
import { ENV } from '../env.provider.js';
import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.decorator.js';
import { RATE_LIMIT_STORE, type RateLimitStore } from './rate-limit.store.js';

/**
 * Глобальный guard: срабатывает только на роутах с @RateLimit. Ключ — IP + имя
 * лимита. При превышении — 429 RATE_LIMITED с Retry-After. При сбое стора
 * fail-open (пропускаем), чтобы проблемы Redis не роняли доступ.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RATE_LIMIT_STORE) private readonly store: RateLimitStore,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options || !this.env.RATE_LIMIT_ENABLED) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const name = options.name ?? `${req.method}:${req.route?.path ?? req.path}`;
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const key = `${name}:${ip}`;

    let hit;
    try {
      hit = await this.store.hit(key, options.windowSec);
    } catch (err) {
      console.error('[rate-limit] стор недоступен, пропускаю запрос:', err);
      return true; // fail-open
    }

    const remaining = Math.max(0, options.limit - hit.count);
    res.setHeader('X-RateLimit-Limit', String(options.limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (hit.count > options.limit) {
      const retryAfterSec = Math.ceil(hit.ttlMs / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      throw new HttpException(
        {
          error: {
            code: 'RATE_LIMITED',
            message: `Слишком много запросов. Повторите через ${retryAfterSec} с.`,
          },
        },
        429,
      );
    }
    return true;
  }
}
