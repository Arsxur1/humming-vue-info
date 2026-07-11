/**
 * Статусы рендер-джоба — единый источник истины для api/worker/web.
 * Порядок стадий соответствует FR-5.1.
 */
export const RENDER_STAGES = [
  'queued',
  'preprocessing',
  'tts',
  'lipsync',
  'compositing',
  'encoding',
] as const;

export const RENDER_TERMINAL_STATUSES = ['done', 'failed', 'cancelled'] as const;

export type RenderStage = (typeof RENDER_STAGES)[number];
export type RenderTerminalStatus = (typeof RENDER_TERMINAL_STATUSES)[number];
export type RenderJobStatus = RenderStage | RenderTerminalStatus;

export const RENDER_QUEUE_NAME = 'render';

export function isTerminalStatus(status: RenderJobStatus): status is RenderTerminalStatus {
  return (RENDER_TERMINAL_STATUSES as readonly string[]).includes(status);
}
