/**
 * Director Markup (дифференциатор D1) — разметка подачи речи и жестов, FR-3.6.
 * Пайплайн: tokenize → parse (AST + валидация) → компиляторы
 * (SSML / gesture_cues / plain text).
 */

export {
  ALL_TAGS,
  EMOTIONS,
  GESTURE_KEY_PATTERN,
  LIMITS,
  LOOK_TARGETS,
  PAIRED_TAGS,
  VOID_TAGS,
  isDirectorTag,
  isVoidTag,
  type DirectorTag,
  type Emotion,
  type LookTarget,
  type PairedTag,
  type VoidTag,
} from './tags.js';

export type {
  BreathNode,
  EmotionNode,
  EmphasisNode,
  GestureNode,
  LookNode,
  MarkupDocument,
  MarkupNode,
  PauseNode,
  PhonemeNode,
  PitchNode,
  RateNode,
  Span,
  TextNode,
} from './ast.js';

export {
  DirectorMarkupError,
  positionAt,
  type MarkupErrorCode,
  type SourcePosition,
} from './errors.js';

export { tokenize, type TagToken, type TextToken, type Token } from './tokenizer.js';
export { parse, safeParse, type SafeParseResult } from './parser.js';
export {
  compileToGestureCues,
  compileToPlainText,
  compileToSSML,
  type GestureCue,
} from './compilers.js';

import { isDirectorTag } from './tags.js';

const TAG_SCAN = /\[\/?([a-z][a-z0-9-]*)(?::[^\]\n]+)?\]/g;

/**
 * Быстрая проверка «есть ли в тексте разметка» — для UI и роутинга пайплайна.
 * Не валидирует корректность — для этого parse/safeParse.
 */
export function containsMarkup(text: string): boolean {
  for (const match of text.matchAll(TAG_SCAN)) {
    const name = match[1];
    if (name !== undefined && isDirectorTag(name)) return true;
  }
  return false;
}
