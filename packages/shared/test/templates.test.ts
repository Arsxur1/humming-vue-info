import { describe, expect, it } from 'vitest';
import { applyVariables, extractPlaceholders } from '../src/templates.js';

describe('extractPlaceholders (FR-6.2)', () => {
  it('находит уникальные плейсхолдеры', () => {
    expect(
      extractPlaceholders('Привет, {{first_name}} из {{company}}! Ещё раз: {{first_name}}.'),
    ).toEqual(['first_name', 'company']);
  });

  it('допускает пробелы внутри скобок', () => {
    expect(extractPlaceholders('{{ product }}')).toEqual(['product']);
  });

  it('игнорирует не-плейсхолдеры', () => {
    expect(extractPlaceholders('обычный {текст} и {{123bad}} и [pause:1s]')).toEqual([]);
  });
});

describe('applyVariables', () => {
  it('подставляет значения', () => {
    expect(
      applyVariables('Привет, {{first_name}} из {{ company }}!', {
        first_name: 'Анна',
        company: 'АО Ромашка',
      }),
    ).toBe('Привет, Анна из АО Ромашка!');
  });

  it('неизвестные плейсхолдеры остаются как есть', () => {
    expect(applyVariables('{{known}} и {{unknown}}', { known: 'да' })).toBe('да и {{unknown}}');
  });

  it('не трогает Director Markup', () => {
    const s = '[pause:0.5s]{{name}}[gesture:nod]';
    expect(applyVariables(s, { name: 'Иван' })).toBe('[pause:0.5s]Иван[gesture:nod]');
  });
});
