import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AspectRatio } from '@avatarstudio/shared';
import { api } from '../api/client.js';
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
    workspaceId,
    saveState,
    selectedSceneId,
    setAspect,
    startRender,
    startScenePreview,
  } = useEditor();
  const [templateSaved, setTemplateSaved] = useState(false);
  if (!project) return null;

  async function saveAsTemplate() {
    const name = window.prompt('Название шаблона:', project!.title);
    if (!name || !workspaceId) return;
    await api('POST', `/api/workspaces/${workspaceId}/templates`, {
      projectId: project!.id,
      name,
      category: 'learning',
    });
    setTemplateSaved(true);
    setTimeout(() => setTemplateSaved(false), 2500);
  }

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
      <button className="ghost" onClick={() => void saveAsTemplate()} data-testid="save-template">
        {templateSaved ? '✓ Шаблон сохранён' : 'В шаблон'}
      </button>
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
