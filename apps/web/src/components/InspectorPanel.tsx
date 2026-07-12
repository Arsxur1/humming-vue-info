import { placementFor, useEditor } from '../store/editor.js';

export function InspectorPanel() {
  const {
    project,
    selectedSceneId,
    selectedLayerId,
    setBackgroundColor,
    addTextLayer,
    updateLayerProps,
    setLayerPlacement,
    removeLayer,
  } = useEditor();
  const scene = project?.scenes.find((s) => s.id === selectedSceneId);
  if (!project || !scene) return <div className="inspector muted">Нет сцены</div>;

  const layer = scene.layers.find((l) => l.id === selectedLayerId);
  const bgColor = typeof scene.background.color === 'string' ? scene.background.color : '#1a1a2e';
  const placement = layer ? placementFor(layer, project.aspectRatio) : null;

  return (
    <div className="inspector">
      <strong>Сцена</strong>
      <label>
        Фон
        <input
          type="color"
          value={bgColor}
          onChange={(e) => setBackgroundColor(scene.id, e.target.value)}
          data-testid="bg-color"
        />
      </label>
      <button onClick={() => addTextLayer(scene.id)} data-testid="add-text-layer">
        + Текстовый слой
      </button>

      {layer && placement && (
        <>
          <strong style={{ marginTop: 8 }}>Слой: {layer.type}</strong>
          {layer.type === 'text' && (
            <label>
              Текст
              <input
                value={String(layer.props.text ?? '')}
                onChange={(e) => updateLayerProps(scene.id, layer.id, { text: e.target.value })}
                data-testid="layer-text"
              />
            </label>
          )}
          <label>
            Масштаб: {placement.scale.toFixed(2)}
            <input
              type="range" min={0.3} max={3} step={0.05}
              value={placement.scale}
              onChange={(e) =>
                setLayerPlacement(scene.id, layer.id, { ...placement, scale: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Поворот: {placement.rotation}°
            <input
              type="range" min={-180} max={180} step={5}
              value={placement.rotation}
              onChange={(e) =>
                setLayerPlacement(scene.id, layer.id, { ...placement, rotation: Number(e.target.value) })
              }
              data-testid="layer-rotation"
            />
          </label>
          <button className="danger" onClick={() => removeLayer(scene.id, layer.id)}>
            Удалить слой
          </button>
        </>
      )}
      {!layer && <p className="muted">Кликните по слою на холсте, чтобы выбрать его.</p>}
      <p className="muted" style={{ marginTop: 'auto' }}>
        Позиции слоёв хранятся отдельно для каждого формата ({project.aspectRatio}).
        Сетка 8px, пунктир — safe-zone.
      </p>
    </div>
  );
}
