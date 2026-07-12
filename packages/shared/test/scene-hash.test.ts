import { describe, expect, it } from 'vitest';
import { sceneContentHash, stableStringify } from '../src/scene-hash.js';

const base = {
  script: 'Привет [pause:1s] мир',
  voiceId: 'vo_1',
  avatarId: 'av_1',
  layers: [{ type: 'text', zIndex: 1, props: { text: 'Заголовок', x: 0.1 } }],
  renderParams: { quality: '1080p' },
};

describe('stableStringify', () => {
  it('не зависит от порядка ключей на любом уровне', () => {
    expect(stableStringify({ a: 1, b: { c: 2, d: 3 } })).toBe(
      stableStringify({ b: { d: 3, c: 2 }, a: 1 }),
    );
  });

  it('undefined-поля отбрасываются, null сохраняется', () => {
    expect(stableStringify({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

describe('sceneContentHash (FR-5.3, правило 3)', () => {
  it('детерминирован и не зависит от порядка ключей в props', () => {
    const reordered = {
      ...base,
      layers: [{ props: { x: 0.1, text: 'Заголовок' }, zIndex: 1, type: 'text' }],
    };
    expect(sceneContentHash(base)).toBe(sceneContentHash(reordered));
  });

  it('чувствителен к каждому компоненту формулы', () => {
    const h = sceneContentHash(base);
    expect(sceneContentHash({ ...base, script: base.script + '!' })).not.toBe(h);
    expect(sceneContentHash({ ...base, voiceId: 'vo_2' })).not.toBe(h);
    expect(sceneContentHash({ ...base, avatarId: 'av_2' })).not.toBe(h);
    expect(sceneContentHash({ ...base, layers: [] })).not.toBe(h);
    expect(sceneContentHash({ ...base, renderParams: { quality: '720p' } })).not.toBe(h);
  });

  it('порядок слоёв значим (это порядок отрисовки)', () => {
    const twoLayers = { ...base, layers: [{ a: 1 }, { b: 2 }] };
    const swapped = { ...base, layers: [{ b: 2 }, { a: 1 }] };
    expect(sceneContentHash(twoLayers)).not.toBe(sceneContentHash(swapped));
  });

  it('формат — hex sha256', () => {
    expect(sceneContentHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});
