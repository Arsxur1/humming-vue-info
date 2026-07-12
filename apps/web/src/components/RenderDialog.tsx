import { useEffect } from 'react';
import { useEditor } from '../store/editor.js';

const STAGE_LABEL: Record<string, string> = {
  queued: 'В очереди',
  preprocessing: 'Подготовка',
  tts: 'Синтез речи',
  lipsync: 'Липсинк',
  compositing: 'Композитинг',
  encoding: 'Кодирование',
  done: 'Готово',
};

export function RenderDialog() {
  const { renderJob, refreshRenderJob, clearRenderJob } = useEditor();

  useEffect(() => {
    if (!renderJob || ['done', 'failed', 'cancelled'].includes(renderJob.status)) return;
    const timer = setInterval(() => void refreshRenderJob(), 700);
    return () => clearInterval(timer);
  }, [renderJob, refreshRenderJob]);

  if (!renderJob) return null;
  const terminal = ['done', 'failed', 'cancelled'].includes(renderJob.status);

  return (
    <div className="render-overlay">
      <div className="render-dialog" data-testid="render-dialog">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>
            Рендер: <span data-testid="render-status">{renderJob.status}</span>
          </strong>
          <button className="ghost" onClick={clearRenderJob}>✕</button>
        </div>

        {!terminal && (
          <>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.round(renderJob.progress * 100)}%` }} />
            </div>
            <p className="muted">
              {STAGE_LABEL[renderJob.stage] ?? renderJob.stage} · {Math.round(renderJob.progress * 100)}%
            </p>
          </>
        )}

        {renderJob.status === 'done' && renderJob.outputUrl && (
          <>
            <video controls src={renderJob.outputUrl} data-testid="render-video" />
            <p className="muted">
              Длительность {(Number(renderJob.durationMs ?? 0) / 1000).toFixed(1)}с · списано{' '}
              {renderJob.creditsCharged ?? '0'} кр. · C2PA-манифест внутри файла
            </p>
          </>
        )}

        {renderJob.status === 'failed' && (
          <p className="error-text">{renderJob.errorMessage ?? 'Рендер не удался'}</p>
        )}
      </div>
    </div>
  );
}
