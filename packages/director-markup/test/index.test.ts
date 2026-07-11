import { describe, expect, it } from 'vitest';
import { ALL_TAGS, containsMarkup, isDirectorTag } from '../src/index.js';

describe('director-markup (заготовка Этапа 0)', () => {
  it('реестр тегов покрывает все теги из ТЗ FR-3.6', () => {
    expect([...ALL_TAGS].sort()).toEqual(
      ['breath', 'emotion', 'emphasis', 'gesture', 'look', 'pause', 'phoneme', 'pitch', 'rate'].sort(),
    );
  });

  it('распознаёт разметку в примерах из ТЗ', () => {
    expect(
      containsMarkup(
        "Welcome aboard. [pause:0.8s] Today we'll cover [emphasis]three[/emphasis] things. [gesture:count-1]",
      ),
    ).toBe(true);
    expect(containsMarkup('[phoneme:ˈkæθɪtər]catheter[/phoneme]')).toBe(true);
    expect(containsMarkup('[breath] Начнём.')).toBe(true);
  });

  it('не срабатывает на обычном тексте и чужих скобках', () => {
    expect(containsMarkup('Обычный текст без разметки.')).toBe(false);
    expect(containsMarkup('Список [1] и ссылка [источник]')).toBe(false);
    expect(containsMarkup('[unknown:tag]')).toBe(false);
  });

  it('isDirectorTag отвергает неизвестные имена', () => {
    expect(isDirectorTag('gesture')).toBe(true);
    expect(isDirectorTag('marquee')).toBe(false);
  });
});
