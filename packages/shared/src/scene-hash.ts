/**
 * Content-hash сцены — основа scene-cache (правило 3 CLAUDE.md, FR-5.3):
 * SHA-256(script + markup + voice_id + avatar_id + layers + render_params).
 * Markup в нашей модели встроен в script (теги Director Markup инлайновые).
 *
 * Импортировать субпутём `@avatarstudio/shared/scene-hash` (использует
 * node:crypto — только для api/worker, не для браузера).
 */
import { createHash } from 'node:crypto';

export interface SceneHashInput {
  /** Скрипт вместе с Director Markup. */
  script: string;
  voiceId: string | null;
  avatarId: string | null;
  /** Слои сцены в порядке z-index; любые JSON-сериализуемые props. */
  layers: readonly unknown[];
  /** Параметры рендера (качество, aspect и т.п.) — Этап 4+. */
  renderParams: Record<string, unknown>;
}

/** Детерминированная JSON-сериализация: ключи объектов сортируются на всех уровнях. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

/** Хеш всего скрипта проекта (для реестра генераций и кейсов модерации). */
export function scriptHash(plainTexts: readonly string[]): string {
  return createHash('sha256').update(plainTexts.join('\n')).digest('hex');
}

export function sceneContentHash(input: SceneHashInput): string {
  const canonical = stableStringify({
    script: input.script,
    voiceId: input.voiceId,
    avatarId: input.avatarId,
    layers: input.layers,
    renderParams: input.renderParams,
  });
  return createHash('sha256').update(canonical).digest('hex');
}
