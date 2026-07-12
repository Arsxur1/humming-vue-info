import { useNavigate } from 'react-router-dom';
import type { AspectRatio } from '@avatarstudio/shared';
import { useEditor } from '../store/editor.js';

const ASPECTS: AspectRatio[] = ['16:9', '9:16', '1:1'];

const SAVE_LABEL: Record<string, string> = {
  saved: 'Сохранено',
  saving: 'Сохранение…',
  conflict: 'Конфликт версий — проект перезагружен',
  error: 'Ошибка сохранения',
};

export function TopBar() {
  const navigate = useNavigate();
  const {
    project,
    saveState,
    selectedSceneId,
    setAspect,
    startRender,
    startScenePreview,
  } = useEditor();
  if (!project) return null;

  return (
    <div className="topbar">
      <button className="ghost" onClick={() => navigate('/')}>← Проекты</button>
      <span className="title">{project.title}</span>
      <span className={`save-chip ${saveState}`} data-testid="save-state">
        {SAVE_LABEL[saveState]}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {ASPECTS.map((a) => (
          <button
            key={a}
            className={project.aspectRatio === a ? '' : 'ghost'}
            onClick={() => void setAspect(a)}
            data-testid={`aspect-${a.replace(':', 'x')}`}
          >
            {a}
          </button>
        ))}
      </div>
      <button
        className="ghost"
        disabled={!selectedSceneId}
        onClick={() => selectedSceneId && void startScenePreview(selectedSceneId)}
        data-testid="preview-scene"
      >
        ▶ Превью сцены
      </button>
      <button
        onClick={() => void startRender('720p')}
        disabled={!project.scenes.length}
        data-testid="start-render"
      >
        Рендер
      </button>
    </div>
  );
}
