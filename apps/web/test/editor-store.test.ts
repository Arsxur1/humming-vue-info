import { describe, expect, it } from 'vitest';
import { placementFor } from '../src/store/editor.js';
import type { Layer } from '../src/api/types.js';

function layer(placements: Record<string, unknown>): Layer {
  return {
    id: 'l1', sceneId: 's1', type: 'text', zIndex: 1,
    props: { placements }, startMs: null, endMs: null, keyframes: null,
  };
}

describe('placementFor (мультиформат, FR-4.8)', () => {
  it('возвращает позицию текущего формата', () => {
    const l = layer({ '9:16': { x: 0.5, y: 0.2, scale: 2, rotation: 15 } });
    expect(placementFor(l, '9:16')).toEqual({ x: 0.5, y: 0.2, scale: 2, rotation: 15 });
  });

  it('фолбэк на 16:9, если формат не настроен', () => {
    const l = layer({ '16:9': { x: 0.3, y: 0.3, scale: 1, rotation: 0 } });
    expect(placementFor(l, '1:1')).toEqual({ x: 0.3, y: 0.3, scale: 1, rotation: 0 });
  });

  it('дефолт, если позиций нет вовсе', () => {
    const l = layer({});
    expect(placementFor(l, '16:9')).toEqual({ x: 0.1, y: 0.1, scale: 1, rotation: 0 });
  });
});
