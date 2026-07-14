import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  /** Максимум запросов за окно. */
  limit: number;
  /** Размер окна в секундах. */
  windowSec: number;
  /** Имя лимита (входит в ключ). По умолчанию — путь роута. */
  name?: string;
}

export const RATE_LIMIT_KEY = 'rate_limit';

/** Ограничение частоты запросов к эндпоинту (по IP). Enforce — глобальный RateLimitGuard. */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
