import { estimateSpeechDurationMs, SCENE_TRANSITIONS } from '@avatarstudio/shared';
import { compileToPlainText, safeParse } from '@avatarstudio/director-markup';
import { useEditor } from '../store/editor.js';

function estimateSec(script: string): string {
  const parsed = safeParse(script);
  const plain = parsed.success ? compileToPlainText(parsed.document) : script;
  return (estimateSpeechDurationMs(plain) / 1000).toFixed(1);
}

export function ScenesPanel() {
  const {
    project,
    selectedSceneId,
    selectScene,
    addScene,
    removeScene,
    reorderScene,
    setTransition,
  } = useEditor();
  if (!project) return null;

  return (
    <div className="scenes-panel">
      <button onClick={() => void addScene()} data-testid="add-scene">
        + Сцена
      </button>
      {project.scenes.map((scene, i) => (
        <div
          key={scene.id}
          className={`scene-item ${scene.id === selectedSceneId ? 'selected' : ''}`}
          data-testid={`scene-item-${i}`}
          onClick={() => selectScene(scene.id)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>Сцена {i + 1}</strong>
            <span className="muted">~{estimateSec(scene.script)}с</span>
          </div>
          <div className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {scene.script || '— пустой скрипт —'}
          </div>
          <div className="row" onClick={(e) => e.stopPropagation()}>
            <select
              value={scene.transition}
              onChange={(e) => setTransition(scene.id, e.target.value as typeof scene.transition)}
              title="Переход к следующей сцене"
            >
              {SCENE_TRANSITIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button className="ghost" onClick={() => void reorderScene(scene.id, -1)} title="Выше">↑</button>
            <button className="ghost" onClick={() => void reorderScene(scene.id, 1)} title="Ниже">↓</button>
            <button className="danger" onClick={() => void removeScene(scene.id)} title="Удалить">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
