/**
 * Property-based тесты (требование Этапа 2): парсер не падает ни на каком
 * вводе иначе как контролируемой DirectorMarkupError, а на валидных
 * документах — детерминирован и обратим в plain text.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { DirectorMarkupError } from '../src/errors.js';
import { parse, safeParse } from '../src/parser.js';
import {
  compileToGestureCues,
  compileToPlainText,
  compileToSSML,
} from '../src/compilers.js';
import { EMOTIONS, LOOK_TARGETS } from '../src/tags.js';

describe('фаззинг: устойчивость к мусору', () => {
  it('safeParse никогда не бросает исключений на произвольных строках', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (input) => {
        const result = safeParse(input);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(DirectorMarkupError);
          expect(result.error.position.line).toBeGreaterThanOrEqual(1);
          expect(result.error.position.column).toBeGreaterThanOrEqual(1);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('parse бросает только DirectorMarkupError на скобочном мусоре', () => {
    const bracketJunk = fc.stringMatching(/^[[\]a-z0-9:./+\- ]{0,80}$/);
    fc.assert(
      fc.property(bracketJunk, (input) => {
        try {
          parse(input);
        } catch (err) {
          expect(err).toBeInstanceOf(DirectorMarkupError);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('компиляторы не падают на любом успешно разобранном вводе', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (input) => {
        const result = safeParse(input);
        if (result.success) {
          compileToSSML(result.document);
          compileToGestureCues(result.document);
          compileToPlainText(result.document);
        }
      }),
      { numRuns: 500 },
    );
  });
});

/** Генератор валидных документов Director Markup. */
const textArb = fc
  .string({ maxLength: 30 })
  .map((s) => s.replaceAll('[', '(').replaceAll(']', ')'));

const voidTagArb = fc.oneof(
  fc.double({ min: 0.1, max: 9.9, noNaN: true }).map((s) => `[pause:${s.toFixed(1)}s]`),
  fc
    .stringMatching(/^[a-z][a-z0-9]{0,5}(-[a-z0-9]{1,4}){0,2}$/)
    .map((k) => `[gesture:${k}]`),
  fc.constantFrom(...LOOK_TARGETS).map((t) => `[look:${t}]`),
  fc.constant('[breath]'),
);

const pairedArb = (inner: fc.Arbitrary<string>): fc.Arbitrary<string> =>
  fc.oneof(
    inner.map((c) => `[emphasis]${c}[/emphasis]`),
    fc
      .tuple(fc.double({ min: 0.5, max: 2, noNaN: true }), inner)
      .map(([r, c]) => `[rate:${r.toFixed(2)}]${c}[/rate]`),
    fc
      .tuple(fc.integer({ min: -12, max: 12 }), inner)
      .map(([p, c]) => `[pitch:${p >= 0 ? '+' : ''}${p}st]${c}[/pitch]`),
    fc
      .tuple(fc.constantFrom(...EMOTIONS), inner)
      .map(([e, c]) => `[emotion:${e}]${c}[/emotion]`),
    fc
      .tuple(fc.stringMatching(/^[a-zɐ-ʯˈˌː]{1,10}$/), fc.stringMatching(/^[a-zа-я ]{1,12}$/))
      .map(([ipa, word]) => `[phoneme:${ipa}]${word}[/phoneme]`),
  );

const validDocArb: fc.Arbitrary<string> = fc
  .array(fc.oneof(textArb, voidTagArb, pairedArb(textArb)), { maxLength: 12 })
  .map((parts) => parts.join(''));

describe('свойства на валидных документах', () => {
  it('валидный документ всегда парсится, SSML сбалансирован', () => {
    fc.assert(
      fc.property(validDocArb, (doc) => {
        const parsed = parse(doc); // не бросает
        const ssml = compileToSSML(parsed);
        // структурная целостность: открытий столько же, сколько закрытий
        for (const tag of ['emphasis', 'prosody', 'phoneme', 'speak']) {
          const opens = ssml.split(`<${tag}`).length - 1;
          const closes = ssml.split(`</${tag}>`).length - 1;
          const selfClosed = 0;
          expect(opens - selfClosed).toBe(closes);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('парсинг детерминирован', () => {
    fc.assert(
      fc.property(validDocArb, (doc) => {
        expect(parse(doc)).toEqual(parse(doc));
      }),
      { numRuns: 200 },
    );
  });

  it('plain text не содержит остатков разметки', () => {
    fc.assert(
      fc.property(validDocArb, (doc) => {
        const plain = compileToPlainText(parse(doc));
        expect(plain).not.toMatch(/\[\/?(?:pause|emphasis|rate|pitch|emotion|phoneme|gesture|look|breath)[:\]]/);
      }),
      { numRuns: 300 },
    );
  });
});
