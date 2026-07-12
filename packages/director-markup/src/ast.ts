import type { Emotion, LookTarget } from './tags.js';

/** Позиция фрагмента в исходном тексте (смещения в символах UTF-16). */
export interface Span {
  start: number;
  end: number;
}

export interface TextNode extends Span {
  type: 'text';
  text: string;
}

export interface PauseNode extends Span {
  type: 'pause';
  seconds: number;
}

export interface GestureNode extends Span {
  type: 'gesture';
  gesture: string;
}

export interface LookNode extends Span {
  type: 'look';
  target: LookTarget;
}

export interface BreathNode extends Span {
  type: 'breath';
}

export interface EmphasisNode extends Span {
  type: 'emphasis';
  children: MarkupNode[];
}

export interface RateNode extends Span {
  type: 'rate';
  /** Множитель темпа, 0.5–2.0. */
  rate: number;
  children: MarkupNode[];
}

export interface PitchNode extends Span {
  type: 'pitch';
  /** Смещение высоты в полутонах, −12…+12. */
  semitones: number;
  children: MarkupNode[];
}

export interface EmotionNode extends Span {
  type: 'emotion';
  emotion: Emotion;
  children: MarkupNode[];
}

export interface PhonemeNode extends Span {
  type: 'phoneme';
  /** IPA-транскрипция. */
  ipa: string;
  /** Слово/фраза, к которой применяется транскрипция (только текст). */
  text: string;
}

export type MarkupNode =
  | TextNode
  | PauseNode
  | GestureNode
  | LookNode
  | BreathNode
  | EmphasisNode
  | RateNode
  | PitchNode
  | EmotionNode
  | PhonemeNode;

export interface MarkupDocument {
  children: MarkupNode[];
  /** Исходный текст — нужен компиляторам и диагностике. */
  source: string;
}
