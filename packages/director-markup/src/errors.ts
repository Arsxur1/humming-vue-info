export interface SourcePosition {
  /** Смещение в символах от начала текста. */
  offset: number;
  /** Строка, с 1. */
  line: number;
  /** Колонка, с 1. */
  column: number;
}

export type MarkupErrorCode =
  | 'UNKNOWN_TAG'
  | 'MISSING_VALUE'
  | 'UNEXPECTED_VALUE'
  | 'INVALID_VALUE'
  | 'UNCLOSED_TAG'
  | 'UNEXPECTED_CLOSE'
  | 'MISMATCHED_CLOSE'
  | 'NESTED_SAME_TAG'
  | 'TAG_INSIDE_PHONEME'
  | 'VOID_TAG_CLOSED';

/**
 * Единственный тип ошибки парсера. Сообщение — человекочитаемое, на русском,
 * с позицией и подсказкой действия (правило 5 из CLAUDE.md).
 */
export class DirectorMarkupError extends Error {
  readonly code: MarkupErrorCode;
  readonly position: SourcePosition;

  constructor(code: MarkupErrorCode, position: SourcePosition, detail: string) {
    super(`Строка ${position.line}, позиция ${position.column}: ${detail}`);
    this.name = 'DirectorMarkupError';
    this.code = code;
    this.position = position;
  }
}

export function positionAt(source: string, offset: number): SourcePosition {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') {
      line += 1;
      lineStart = i + 1;
    }
  }
  return { offset, line, column: offset - lineStart + 1 };
}
