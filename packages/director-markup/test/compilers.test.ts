import { describe, expect, it } from 'vitest';
import { parse } from '../src/parser.js';
import {
  compileToGestureCues,
  compileToPlainText,
  compileToSSML,
} from '../src/compilers.js';

describe('compileToSSML', () => {
  it('компилирует пример из ТЗ в валидные SSML-элементы', () => {
    const ssml = compileToSSML(
      parse(
        "Welcome aboard. [pause:0.8s] Today we'll cover [emphasis]three[/emphasis] things. [gesture:count-1]",
      ),
    );
    expect(ssml.startsWith('<speak>')).toBe(true);
    expect(ssml.endsWith('</speak>')).toBe(true);
    expect(ssml).toContain('<break time="800ms"/>');
    expect(ssml).toContain('<emphasis level="strong">three</emphasis>');
    expect(ssml).toContain('<mark name="gesture:count-1"/>');
  });

  it('rate → prosody rate в процентах, pitch → в полутонах', () => {
    expect(compileToSSML(parse('[rate:0.85]тише[/rate]'))).toContain('<prosody rate="85%">');
    expect(compileToSSML(parse('[pitch:+2st]выше[/pitch]'))).toContain('<prosody pitch="+2st">');
    expect(compileToSSML(parse('[pitch:-3.5st]ниже[/pitch]'))).toContain(
      '<prosody pitch="-3.5st">',
    );
  });

  it('phoneme → <phoneme alphabet="ipa">', () => {
    expect(compileToSSML(parse('[phoneme:ˈkæθɪtər]catheter[/phoneme]'))).toContain(
      '<phoneme alphabet="ipa" ph="ˈkæθɪtər">catheter</phoneme>',
    );
  });

  it('emotion/look/breath → mark-события', () => {
    const ssml = compileToSSML(parse('[emotion:confident]да[/emotion] [look:camera] [breath]'));
    expect(ssml).toContain('<mark name="emotion:confident:start"/>');
    expect(ssml).toContain('<mark name="emotion:confident:end"/>');
    expect(ssml).toContain('<mark name="look:camera"/>');
    expect(ssml).toContain('<mark name="breath"/>');
  });

  it('паузы ≥ 1 c — в секундах без хвостовых нулей', () => {
    expect(compileToSSML(parse('[pause:1.2s]'))).toContain('<break time="1.2s"/>');
    expect(compileToSSML(parse('[pause:2s]'))).toContain('<break time="2s"/>');
  });

  it('экранирует XML-спецсимволы в тексте', () => {
    const ssml = compileToSSML(parse('5 < 7 & "кавычки" <b>'));
    expect(ssml).toContain('5 &lt; 7 &amp; &quot;кавычки&quot; &lt;b&gt;');
    expect(ssml).not.toContain('<b>');
  });
});

describe('compileToGestureCues', () => {
  it('привязывает сигналы к смещениям в plain-тексте', () => {
    const doc = parse('Привет. [gesture:nod]Смотри [look:slide]сюда. [breath]');
    const plain = compileToPlainText(doc);
    const cues = compileToGestureCues(doc);
    expect(cues).toEqual([
      { kind: 'gesture', key: 'nod', textOffset: 'Привет. '.length },
      { kind: 'look', key: 'slide', textOffset: 'Привет. Смотри '.length },
      { kind: 'breath', key: 'breath', textOffset: plain.length },
    ]);
  });

  it('видит сигналы внутри парных тегов', () => {
    const cues = compileToGestureCues(parse('[emotion:friendly]раз [gesture:count-1][/emotion]'));
    expect(cues).toEqual([{ kind: 'gesture', key: 'count-1', textOffset: 4 }]);
  });

  it('пустой документ — пустой список', () => {
    expect(compileToGestureCues(parse(''))).toEqual([]);
  });
});

describe('compileToPlainText', () => {
  it('убирает всю разметку, сохраняя текст', () => {
    const plain = compileToPlainText(
      parse(
        '[emotion:serious]Важно: [emphasis]три[/emphasis] пункта.[/emotion] [pause:1s][gesture:count-1]Первый.',
      ),
    );
    expect(plain).toBe('Важно: три пункта. Первый.');
  });

  it('phoneme даёт видимый текст, не IPA', () => {
    expect(compileToPlainText(parse('Скажи [phoneme:ˈkæθɪtər]catheter[/phoneme] чётко'))).toBe(
      'Скажи catheter чётко',
    );
  });

  it('текст без разметки проходит без изменений', () => {
    const text = 'Обычный текст со [скобками 1] и (прочим).';
    expect(compileToPlainText(parse(text))).toBe(text);
  });
});
