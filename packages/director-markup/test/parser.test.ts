import { describe, expect, it } from 'vitest';
import { parse, safeParse } from '../src/parser.js';
import { DirectorMarkupError } from '../src/errors.js';
import type { EmotionNode, PauseNode, PhonemeNode, RateNode } from '../src/ast.js';

function firstError(source: string): DirectorMarkupError {
  const result = safeParse(source);
  if (result.success) throw new Error(`ожидалась ошибка для: ${source}`);
  return result.error;
}

describe('parse: все примеры из ТЗ FR-3.6', () => {
  it('парсит полный блок примеров из ТЗ', () => {
    const examples = [
      '[pause:1.2s]',
      '[emphasis]слово[/emphasis]',
      '[rate:0.85] медленнее [/rate]',
      '[pitch:+2st] выше [/pitch]',
      '[emotion:confident] уверенно [/emotion]',
      '[phoneme:ˈkæθɪtər]catheter[/phoneme]',
      '[gesture:point-right]',
      '[gesture:open-hands]',
      '[gesture:nod]',
      '[gesture:count-1] [gesture:count-2] [gesture:count-3]',
      '[look:camera] и [look:slide]',
      '[breath]',
    ];
    for (const example of examples) {
      expect(() => parse(example), example).not.toThrow();
    }
  });

  it('парсит скрипт из примера API (Часть 7 ТЗ)', () => {
    const doc = parse(
      "Welcome aboard. [pause:0.8s] Today we'll cover [emphasis]three[/emphasis] things. [gesture:count-1]",
    );
    const types = doc.children.map((n) => n.type);
    expect(types).toEqual(['text', 'pause', 'text', 'emphasis', 'text', 'gesture']);
  });

  it('разбирает значения: pause в секундах и миллисекундах', () => {
    const s = parse('[pause:1.2s]').children[0] as PauseNode;
    expect(s.seconds).toBeCloseTo(1.2);
    const ms = parse('[pause:500ms]').children[0] as PauseNode;
    expect(ms.seconds).toBeCloseTo(0.5);
  });

  it('разбирает rate/pitch/emotion в типизированные значения', () => {
    const rate = parse('[rate:0.85]x[/rate]').children[0] as RateNode;
    expect(rate.rate).toBeCloseTo(0.85);
    const emotion = parse('[emotion:serious]x[/emotion]').children[0] as EmotionNode;
    expect(emotion.emotion).toBe('serious');
  });

  it('phoneme: IPA и текст без вложенности', () => {
    const node = parse('[phoneme:ˈkæθɪtər]catheter[/phoneme]').children[0] as PhonemeNode;
    expect(node.ipa).toBe('ˈkæθɪtər');
    expect(node.text).toBe('catheter');
  });

  it('поддерживает вложенность разных парных тегов', () => {
    const doc = parse('[emotion:friendly][rate:0.9]спокойно и [emphasis]чётко[/emphasis][/rate][/emotion]');
    expect(doc.children).toHaveLength(1);
  });

  it('обычные скобки в тексте — не разметка', () => {
    const doc = parse('Список [1], ссылка [источник], формула [x + y] и [see 4].');
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0]!.type).toBe('text');
  });
});

describe('parse: валидация и человекочитаемые ошибки с позицией', () => {
  it('неизвестный тег', () => {
    const err = firstError('привет [gestur:nod]');
    expect(err.code).toBe('UNKNOWN_TAG');
    expect(err.message).toMatch(/неизвестный тег \[gestur\]/);
    expect(err.position.offset).toBe(7);
  });

  it('незакрытый парный тег', () => {
    const err = firstError('[rate:0.9]быстро');
    expect(err.code).toBe('UNCLOSED_TAG');
    expect(err.message).toMatch(/добавьте \[\/rate\]/);
  });

  it('закрытие без открытия', () => {
    expect(firstError('текст[/emphasis]').code).toBe('UNEXPECTED_CLOSE');
  });

  it('перекрёстное закрытие', () => {
    const err = firstError('[rate:0.9][emphasis]x[/rate][/emphasis]');
    expect(err.code).toBe('MISMATCHED_CLOSE');
    expect(err.message).toMatch(/обратном открытию/);
  });

  it('вложение тега в самого себя', () => {
    expect(firstError('[emphasis]a[emphasis]b[/emphasis][/emphasis]').code).toBe(
      'NESTED_SAME_TAG',
    );
  });

  it('тег внутри phoneme', () => {
    expect(firstError('[phoneme:x]слово[breath][/phoneme]').code).toBe('TAG_INSIDE_PHONEME');
  });

  it('закрытие самозакрывающегося тега', () => {
    expect(firstError('[breath]x[/breath]').code).toBe('VOID_TAG_CLOSED');
  });

  it('значение у закрывающего тега', () => {
    expect(firstError('[rate:0.9]x[/rate:0.9]').code).toBe('UNEXPECTED_VALUE');
  });

  it('границы значений: pause', () => {
    expect(firstError('[pause:11s]').code).toBe('INVALID_VALUE');
    expect(firstError('[pause:10ms]').code).toBe('INVALID_VALUE');
    expect(firstError('[pause:abc]').code).toBe('INVALID_VALUE');
    expect(firstError('[pause]').code).toBe('MISSING_VALUE');
  });

  it('границы значений: rate', () => {
    expect(firstError('[rate:0.3]x[/rate]').code).toBe('INVALID_VALUE');
    expect(firstError('[rate:2.5]x[/rate]').code).toBe('INVALID_VALUE');
    expect(firstError('[rate:-1]x[/rate]').code).toBe('INVALID_VALUE');
    expect(safeParse('[rate:0.5]x[/rate]').success).toBe(true);
    expect(safeParse('[rate:2]x[/rate]').success).toBe(true);
  });

  it('границы значений: pitch', () => {
    expect(firstError('[pitch:+13st]x[/pitch]').code).toBe('INVALID_VALUE');
    expect(firstError('[pitch:2st]x[/pitch]').code).toBe('INVALID_VALUE'); // нужен знак
    expect(firstError('[pitch:+2]x[/pitch]').code).toBe('INVALID_VALUE'); // нужен st
    expect(safeParse('[pitch:-12st]x[/pitch]').success).toBe(true);
  });

  it('emotion и look — только из списка', () => {
    const err = firstError('[emotion:angry]x[/emotion]');
    expect(err.code).toBe('INVALID_VALUE');
    expect(err.message).toMatch(/Доступно:/);
    expect(firstError('[look:window]').code).toBe('INVALID_VALUE');
  });

  it('ключ жеста — kebab-case', () => {
    expect(firstError('[gesture:Point_Right]').code).toBe('INVALID_VALUE');
    expect(firstError('[gesture:-bad]').code).toBe('INVALID_VALUE');
  });

  it('emphasis и breath не принимают значение', () => {
    expect(firstError('[emphasis:strong]x[/emphasis]').code).toBe('UNEXPECTED_VALUE');
    expect(firstError('[breath:deep]').code).toBe('UNEXPECTED_VALUE');
  });

  it('позиция ошибки: строка и колонка на многострочном тексте', () => {
    const err = firstError('первая строка\nвторая [oops] строка');
    expect(err.position.line).toBe(2);
    expect(err.position.column).toBe(8);
  });
});
