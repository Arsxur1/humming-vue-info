/**
 * Director Markup (дифференциатор D1) — разметка подачи речи и жестов, FR-3.6.
 *
 * Этап 0: только реестр тегов и вспомогательные проверки.
 * Полный парсер (токенизатор → AST → валидация → компиляторы SSML /
 * gesture_cues / plain text) — Этап 2 по docs/PLAN.md.
 */

/** Самозакрывающиеся теги: [tag] или [tag:value] без парного [/tag]. */
export const VOID_TAGS = ['pause', 'gesture', 'look', 'breath'] as const;

/** Парные теги: [tag]…[/tag] или [tag:value]…[/tag]. */
export const PAIRED_TAGS = ['emphasis', 'rate', 'pitch', 'emotion', 'phoneme'] as const;

export const ALL_TAGS = [...VOID_TAGS, ...PAIRED_TAGS] as const;

export type VoidTag = (typeof VOID_TAGS)[number];
export type PairedTag = (typeof PAIRED_TAGS)[number];
export type DirectorTag = (typeof ALL_TAGS)[number];

const TAG_PATTERN = /\[\/?([a-z-]+)(?::[^\]]+)?\]/g;

export function isDirectorTag(name: string): name is DirectorTag {
  return (ALL_TAGS as readonly string[]).includes(name);
}

/**
 * Быстрая проверка «есть ли в тексте разметка» — для UI и роутинга пайплайна.
 * Не валидирует корректность: этим займётся парсер Этапа 2.
 */
export function containsMarkup(text: string): boolean {
  for (const match of text.matchAll(TAG_PATTERN)) {
    const name = match[1];
    if (name !== undefined && isDirectorTag(name)) return true;
  }
  return false;
}
