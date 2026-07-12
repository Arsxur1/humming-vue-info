import { z } from 'zod';

/** Качества MVP (4K сознательно исключён — CLAUDE.md «что НЕ делать»). */
export const RENDER_QUALITIES = ['720p', '1080p'] as const;
export type RenderQuality = (typeof RENDER_QUALITIES)[number];

/** Множители кредитов (FR-10.1). База: 1 кредит = 1 минута 1080p. */
export const CREDIT_MULTIPLIERS: Record<RenderQuality, number> = {
  '720p': 0.4,
  '1080p': 1.0,
};

export const createRenderJobSchema = z.object({
  quality: z.enum(RENDER_QUALITIES).default('720p'),
});
export type CreateRenderJobDto = z.infer<typeof createRenderJobSchema>;

/**
 * Оценка длительности речи по тексту: ~350 мс на слово, минимум 1 с.
 * [допущение] Средний темп диктора ~170 слов/мин. Формула единая для
 * MockTTS и оценки кредитов — у моков estimate == actual.
 */
export function estimateSpeechDurationMs(plainText: string): number {
  const words = plainText.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1000, words * 350);
}

/** Стоимость рендера в кредитах, округление вверх до 0.01. */
export function creditCost(durationMs: number, quality: RenderQuality): number {
  const minutes = durationMs / 60_000;
  return Math.ceil(minutes * CREDIT_MULTIPLIERS[quality] * 100) / 100;
}

/** Размер кадра по aspect ratio и качеству (высота = 720/1080 по короткой стороне 16:9). */
export function frameSize(aspectRatio: string, quality: RenderQuality): { width: number; height: number } {
  const base = quality === '1080p' ? 1080 : 720;
  const [wRatio, hRatio] = aspectRatio.split(':').map(Number);
  if (!wRatio || !hRatio) return { width: (base * 16) / 9, height: base };
  // Короткая сторона = base; чётные размеры для yuv420p
  const even = (n: number) => Math.round(n / 2) * 2;
  if (wRatio >= hRatio) {
    return { width: even((base * wRatio) / hRatio), height: base };
  }
  return { width: even(base), height: even((base * hRatio) / wRatio) };
}
