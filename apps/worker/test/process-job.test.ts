import { describe, expect, it } from 'vitest';
import { processRenderJob } from '../src/process-job.js';

describe('processRenderJob (заглушка Этапа 0)', () => {
  it('подтверждает корректный джоб', () => {
    expect(processRenderJob({ projectId: 'prj_1' })).toEqual({
      acknowledged: true,
      projectId: 'prj_1',
    });
  });

  it('отклоняет джоб без projectId с человекочитаемой ошибкой', () => {
    expect(() => processRenderJob({ projectId: '' })).toThrowError(/без projectId/);
  });
});
