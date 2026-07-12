import type {
  EmotionNode,
  EmphasisNode,
  MarkupDocument,
  MarkupNode,
  PitchNode,
  RateNode,
} from './ast.js';
import { DirectorMarkupError, positionAt } from './errors.js';
import {
  EMOTIONS,
  GESTURE_KEY_PATTERN,
  LIMITS,
  LOOK_TARGETS,
  isDirectorTag,
  isVoidTag,
  type Emotion,
  type LookTarget,
} from './tags.js';
import { tokenize, type TagToken } from './tokenizer.js';

type OpenElement = EmphasisNode | RateNode | PitchNode | EmotionNode;

interface PhonemeFrame {
  kind: 'phoneme';
  ipa: string;
  start: number;
  textParts: string[];
}

interface ElementFrame {
  kind: 'element';
  node: OpenElement;
}

type Frame = ElementFrame | PhonemeFrame;

/** Разбирает Director Markup. Бросает DirectorMarkupError с позицией. */
export function parse(source: string): MarkupDocument {
  const root: MarkupNode[] = [];
  const stack: Frame[] = [];

  const fail = (code: ConstructorParameters<typeof DirectorMarkupError>[0], offset: number, detail: string): never => {
    throw new DirectorMarkupError(code, positionAt(source, offset), detail);
  };

  const currentChildren = (): MarkupNode[] => {
    const top = stack[stack.length - 1];
    if (!top) return root;
    if (top.kind === 'phoneme') {
      // недостижимо при корректной работе parse: теги внутри phoneme отсекаются раньше
      throw new Error('phoneme не содержит дочерних узлов');
    }
    return top.node.children;
  };

  const append = (node: MarkupNode): void => {
    currentChildren().push(node);
  };

  for (const token of tokenize(source)) {
    const top = stack[stack.length - 1];

    if (token.kind === 'text') {
      if (top?.kind === 'phoneme') {
        top.textParts.push(token.text);
      } else {
        append({ type: 'text', text: token.text, start: token.start, end: token.end });
      }
      continue;
    }

    if (!isDirectorTag(token.name)) {
      fail(
        'UNKNOWN_TAG',
        token.start,
        `неизвестный тег [${token.name}]. Доступные теги: pause, emphasis, rate, pitch, emotion, phoneme, gesture, look, breath.`,
      );
    }
    const name = token.name as import('./tags.js').DirectorTag;

    // Внутри [phoneme] допустим только текст и его собственный закрывающий тег.
    if (top?.kind === 'phoneme' && !(token.closing && name === 'phoneme')) {
      fail(
        'TAG_INSIDE_PHONEME',
        token.start,
        `внутри [phoneme]…[/phoneme] допустим только текст, найден тег [${token.name}]. Уберите вложенный тег.`,
      );
    }

    if (token.closing) {
      handleClose(token, name);
    } else if (isVoidTag(name)) {
      appendVoid(token, name);
    } else {
      handleOpen(token, name);
    }
  }

  const unclosed = stack[stack.length - 1];
  if (unclosed) {
    const tagName = unclosed.kind === 'phoneme' ? 'phoneme' : unclosed.node.type;
    const start = unclosed.kind === 'phoneme' ? unclosed.start : unclosed.node.start;
    fail('UNCLOSED_TAG', start, `тег [${tagName}] не закрыт — добавьте [/${tagName}].`);
  }

  return { children: root, source };

  function handleClose(token: TagToken, name: import('./tags.js').DirectorTag): void {
    if (token.value !== null) {
      fail('UNEXPECTED_VALUE', token.start, `закрывающий тег [/${name}] не принимает значение.`);
    }
    if (isVoidTag(name)) {
      fail(
        'VOID_TAG_CLOSED',
        token.start,
        `тег [${name}] самозакрывающийся — у него нет парного [/${name}].`,
      );
    }
    const top = stack[stack.length - 1];
    if (!top) {
      fail(
        'UNEXPECTED_CLOSE',
        token.start,
        `[/${name}] без открывающего [${name}]. Удалите лишний закрывающий тег.`,
      );
      return;
    }
    if (top.kind === 'phoneme') {
      // name === 'phoneme' — другие теги внутри phoneme отсечены выше
      stack.pop();
      append({
        type: 'phoneme',
        ipa: top.ipa,
        text: top.textParts.join(''),
        start: top.start,
        end: token.end,
      });
      return;
    }
    if (top.node.type !== name) {
      fail(
        'MISMATCHED_CLOSE',
        token.start,
        `ожидался [/${top.node.type}], найден [/${name}]. Закройте теги в порядке, обратном открытию.`,
      );
    }
    stack.pop();
    top.node.end = token.end;
    append(top.node);
  }

  function appendVoid(token: TagToken, name: import('./tags.js').VoidTag): void {
    const span = { start: token.start, end: token.end };
    switch (name) {
      case 'breath': {
        if (token.value !== null) {
          fail('UNEXPECTED_VALUE', token.start, `тег [breath] не принимает значение.`);
        }
        append({ type: 'breath', ...span });
        return;
      }
      case 'pause': {
        const raw = requireValue(token, 'pause', 'например [pause:1.2s] или [pause:500ms]');
        const match = /^(\d+(?:\.\d+)?)(s|ms)$/.exec(raw);
        if (!match) {
          fail(
            'INVALID_VALUE',
            token.start,
            `не удалось разобрать паузу «${raw}». Формат: [pause:1.2s] или [pause:500ms].`,
          );
        }
        const seconds = match![2] === 'ms' ? Number(match![1]) / 1000 : Number(match![1]);
        if (seconds < LIMITS.pauseSecondsMin || seconds > LIMITS.pauseSecondsMax) {
          fail(
            'INVALID_VALUE',
            token.start,
            `пауза ${raw} вне допустимого диапазона ${LIMITS.pauseSecondsMin}–${LIMITS.pauseSecondsMax} с.`,
          );
        }
        append({ type: 'pause', seconds, ...span });
        return;
      }
      case 'gesture': {
        const raw = requireValue(token, 'gesture', 'например [gesture:point-right]');
        if (!GESTURE_KEY_PATTERN.test(raw)) {
          fail(
            'INVALID_VALUE',
            token.start,
            `ключ жеста «${raw}» должен быть в kebab-case: латиница, цифры, дефисы (point-right, count-1).`,
          );
        }
        append({ type: 'gesture', gesture: raw, ...span });
        return;
      }
      case 'look': {
        const raw = requireValue(token, 'look', 'например [look:camera]');
        if (!(LOOK_TARGETS as readonly string[]).includes(raw)) {
          fail(
            'INVALID_VALUE',
            token.start,
            `направление взгляда «${raw}» не поддерживается. Доступно: ${LOOK_TARGETS.join(', ')}.`,
          );
        }
        append({ type: 'look', target: raw as LookTarget, ...span });
        return;
      }
    }
  }

  function handleOpen(token: TagToken, name: import('./tags.js').PairedTag): void {
    if (stack.some((f) => f.kind === 'element' && f.node.type === name)) {
      fail(
        'NESTED_SAME_TAG',
        token.start,
        `тег [${name}] уже открыт — вложение тега в самого себя не поддерживается.`,
      );
    }
    const span = { start: token.start, end: token.end };
    switch (name) {
      case 'phoneme': {
        const ipa = requireValue(token, 'phoneme', 'например [phoneme:ˈkæθɪtər]catheter[/phoneme]');
        stack.push({ kind: 'phoneme', ipa, start: token.start, textParts: [] });
        return;
      }
      case 'emphasis': {
        if (token.value !== null) {
          fail('UNEXPECTED_VALUE', token.start, `тег [emphasis] не принимает значение.`);
        }
        stack.push({ kind: 'element', node: { type: 'emphasis', children: [], ...span } });
        return;
      }
      case 'rate': {
        const raw = requireValue(token, 'rate', 'например [rate:0.85]');
        const rate = /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : NaN;
        if (Number.isNaN(rate) || rate < LIMITS.rateMin || rate > LIMITS.rateMax) {
          fail(
            'INVALID_VALUE',
            token.start,
            `темп «${raw}» вне диапазона ${LIMITS.rateMin}–${LIMITS.rateMax} (1.0 — обычный).`,
          );
        }
        stack.push({ kind: 'element', node: { type: 'rate', rate, children: [], ...span } });
        return;
      }
      case 'pitch': {
        const raw = requireValue(token, 'pitch', 'например [pitch:+2st]');
        const match = /^([+-]\d+(?:\.\d+)?)st$/.exec(raw);
        const semitones = match ? Number(match[1]) : NaN;
        if (Number.isNaN(semitones) || Math.abs(semitones) > LIMITS.pitchSemitonesMax) {
          fail(
            'INVALID_VALUE',
            token.start,
            `высота «${raw}» не распознана или вне диапазона ±${LIMITS.pitchSemitonesMax}st. Формат: [pitch:+2st].`,
          );
        }
        stack.push({ kind: 'element', node: { type: 'pitch', semitones, children: [], ...span } });
        return;
      }
      case 'emotion': {
        const raw = requireValue(token, 'emotion', 'например [emotion:confident]');
        if (!(EMOTIONS as readonly string[]).includes(raw)) {
          fail(
            'INVALID_VALUE',
            token.start,
            `эмоция «${raw}» не поддерживается. Доступно: ${EMOTIONS.join(', ')}.`,
          );
        }
        stack.push({
          kind: 'element',
          node: { type: 'emotion', emotion: raw as Emotion, children: [], ...span },
        });
        return;
      }
    }
  }

  function requireValue(token: TagToken, name: string, hint: string): string {
    if (token.value === null || token.value.trim() === '') {
      fail('MISSING_VALUE', token.start, `тегу [${name}] нужно значение, ${hint}.`);
    }
    return token.value!.trim();
  }
}

export type SafeParseResult =
  | { success: true; document: MarkupDocument }
  | { success: false; error: DirectorMarkupError };

/** parse без исключений: единственный источник ошибок — DirectorMarkupError. */
export function safeParse(source: string): SafeParseResult {
  try {
    return { success: true, document: parse(source) };
  } catch (err) {
    if (err instanceof DirectorMarkupError) return { success: false, error: err };
    throw err;
  }
}
