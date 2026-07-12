/**
 * Реестр тегов Director Markup (ТЗ FR-3.6) и границы значений.
 * Новый тег = запись здесь + правило значения + тесты; парсер не меняется.
 */

/** Самозакрывающиеся теги: [tag] или [tag:value]. */
export const VOID_TAGS = ['pause', 'gesture', 'look', 'breath'] as const;

/** Парные теги: [tag]…[/tag] или [tag:value]…[/tag]. */
export const PAIRED_TAGS = ['emphasis', 'rate', 'pitch', 'emotion', 'phoneme'] as const;

export const ALL_TAGS = [...VOID_TAGS, ...PAIRED_TAGS] as const;

export type VoidTag = (typeof VOID_TAGS)[number];
export type PairedTag = (typeof PAIRED_TAGS)[number];
export type DirectorTag = (typeof ALL_TAGS)[number];

export function isDirectorTag(name: string): name is DirectorTag {
  return (ALL_TAGS as readonly string[]).includes(name);
}

export function isVoidTag(name: DirectorTag): name is VoidTag {
  return (VOID_TAGS as readonly string[]).includes(name);
}

/** Эмоциональные пресеты (FR-3.2). */
export const EMOTIONS = [
  'neutral',
  'friendly',
  'confident',
  'energetic',
  'serious',
  'empathetic',
] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** Направления взгляда (FR-3.6). */
export const LOOK_TARGETS = ['camera', 'slide'] as const;
export type LookTarget = (typeof LOOK_TARGETS)[number];

/** Границы значений — валидируются парсером. */
export const LIMITS = {
  pauseSecondsMin: 0.05,
  pauseSecondsMax: 10,
  rateMin: 0.5,
  rateMax: 2,
  pitchSemitonesMax: 12,
} as const;

/** Ключ жеста: kebab-case (набор жестов — свойство аватара, конфиг, не код). */
export const GESTURE_KEY_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
