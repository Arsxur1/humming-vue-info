import { useRef } from 'react';
import { safeParse } from '@avatarstudio/director-markup';
import { useEditor } from '../store/editor.js';

/** Кнопки вставки Director Markup (FR-3.6: UI обязан давать кнопки, ручной ввод — для продвинутых). */
const INSERTS: Array<{ label: string; snippet: string; wrap?: string }> = [
  { label: '⏸ Пауза', snippet: '[pause:0.5s]' },
  { label: '❗ Ударение', snippet: '[emphasis]', wrap: '[/emphasis]' },
  { label: '🐢 Темп', snippet: '[rate:0.85]', wrap: '[/rate]' },
  { label: '🎵 Высота', snippet: '[pitch:+2st]', wrap: '[/pitch]' },
  { label: '🙂 Эмоция', snippet: '[emotion:confident]', wrap: '[/emotion]' },
  { label: '🔤 Фонема', snippet: '[phoneme:ˈkæθɪtər]', wrap: '[/phoneme]' },
  { label: '👉 Жест', snippet: '[gesture:point-right]' },
  { label: '👀 Взгляд', snippet: '[look:camera]' },
  { label: '🌬 Вдох', snippet: '[breath]' },
];

export function ScriptPanel() {
  const { project, selectedSceneId, setScript } = useEditor();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scene = project?.scenes.find((s) => s.id === selectedSceneId);
  if (!scene) return <div className="script-panel muted">Выберите сцену</div>;

  const parsed = safeParse(scene.script);

  function insert(snippet: string, wrap?: string) {
    const el = textareaRef.current;
    if (!el || !scene) return;
    const start = el.selectionStart ?? scene.script.length;
    const end = el.selectionEnd ?? start;
    const before = scene.script.slice(0, start);
    const middle = scene.script.slice(start, end);
    const after = scene.script.slice(end);
    const next = wrap ? `${before}${snippet}${middle}${wrap}${after}` : `${before}${snippet}${middle}${after}`;
    setScript(scene.id, next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + snippet.length + (wrap ? middle.length : 0);
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="script-panel">
      <div className="markup-toolbar">
        {INSERTS.map((item) => (
          <button
            key={item.label}
            type="button"
            title={item.snippet}
            data-testid={`markup-${item.snippet.slice(1).split(/[:\]]/)[0]}`}
            onClick={() => insert(item.snippet, item.wrap)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        rows={4}
        placeholder="Скрипт сцены. Разметка подачи: [pause:0.5s], [emphasis]…[/emphasis], [gesture:nod]…"
        value={scene.script}
        onChange={(e) => setScript(scene.id, e.target.value)}
        data-testid="script-input"
      />
      {!parsed.success && (
        <p className="error-text" data-testid="markup-error">
          {parsed.error.message}
        </p>
      )}
    </div>
  );
}
