/**
 * Обработчик рендер-джоба. На Этапе 0 — заглушка: подтверждает получение.
 * Реальный DAG (preprocessing → tts → lipsync → compositing → encoding)
 * появится на Этапе 4 (docs/PLAN.md).
 */
export interface RenderJobPayload {
  projectId: string;
}

export interface RenderJobResult {
  acknowledged: true;
  projectId: string;
}

export function processRenderJob(payload: RenderJobPayload): RenderJobResult {
  if (!payload.projectId) {
    throw new Error('render job без projectId — джоб некорректно поставлен в очередь');
  }
  return { acknowledged: true, projectId: payload.projectId };
}
