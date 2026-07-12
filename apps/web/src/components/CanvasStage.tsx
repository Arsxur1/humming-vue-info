import { useEffect, useRef } from 'react';
import { Application, Container, FederatedPointerEvent, Graphics, Text } from 'pixi.js';
import { placementFor, useEditor, type LayerPlacement } from '../store/editor.js';

const GRID = 8;
const SAFE_ZONE = 0.05; // 5% от краёв

function canvasSize(aspect: string): { w: number; h: number } {
  if (aspect === '9:16') return { w: 304, h: 540 };
  if (aspect === '1:1') return { w: 480, h: 480 };
  if (aspect === '4:5') return { w: 432, h: 540 };
  if (aspect === '4:3') return { w: 640, h: 480 };
  return { w: 800, h: 450 }; // 16:9
}

const snap = (v: number) => Math.round(v / GRID) * GRID;

/**
 * Canvas-превью сцены (PixiJS): фон, аватар-плейсхолдер, текстовые слои.
 * Drag с привязкой к сетке 8px, resize-ручка, выделение, safe-zone.
 */
export function CanvasStage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const readyRef = useRef(false);

  const project = useEditor((s) => s.project);
  const selectedSceneId = useEditor((s) => s.selectedSceneId);
  const selectedLayerId = useEditor((s) => s.selectedLayerId);

  // Инициализация Pixi один раз. destroy — только после завершения init
  // (StrictMode размонтирует до готовности — иначе Pixi падает).
  useEffect(() => {
    const app = new Application();
    appRef.current = app;
    let cancelled = false;
    const ready = app
      .init({ width: 800, height: 450, background: 0x0a0c12, antialias: true })
      .then(() => {
        if (cancelled || !hostRef.current) return;
        app.canvas.setAttribute('data-testid', 'editor-canvas');
        hostRef.current.appendChild(app.canvas);
        readyRef.current = true;
        rebuild();
      })
      .catch((err) => console.error('[canvas] init failed:', err));
    return () => {
      cancelled = true;
      readyRef.current = false;
      appRef.current = null;
      void ready.then(() => {
        try {
          app.destroy(true, { children: true });
        } catch {
          // повторный destroy при быстрой перемонтировке — не критично
        }
      });
    };
  }, []);

  // Перерисовка при изменении состояния
  useEffect(() => {
    rebuild();
  }, [project, selectedSceneId, selectedLayerId]);

  function rebuild() {
    const app = appRef.current;
    if (!app || !readyRef.current) return;
    const state = useEditor.getState();
    const proj = state.project;
    const scene = proj?.scenes.find((s) => s.id === state.selectedSceneId);
    if (!proj || !scene) return;

    const { w, h } = canvasSize(proj.aspectRatio);
    app.renderer.resize(w, h);
    app.stage.removeChildren();
    app.stage.eventMode = 'static';
    app.stage.hitArea = { contains: (x, y) => x >= 0 && x <= w && y >= 0 && y <= h };

    // Фон
    const bgColor = typeof scene.background.color === 'string'
      ? Number(`0x${scene.background.color.replace('#', '')}`)
      : 0x1a1a2e;
    app.stage.addChild(new Graphics().rect(0, 0, w, h).fill(bgColor));

    // Сетка (едва заметная)
    const grid = new Graphics();
    for (let x = GRID; x < w; x += GRID * 4) grid.moveTo(x, 0).lineTo(x, h);
    for (let y = GRID; y < h; y += GRID * 4) grid.moveTo(0, y).lineTo(w, y);
    grid.stroke({ width: 1, color: 0xffffff, alpha: 0.04 });
    app.stage.addChild(grid);

    // Аватар-плейсхолдер (позиция per-format в background.avatarPlacements)
    const avatarPlacements = (scene.background.avatarPlacements ?? {}) as Record<string, LayerPlacement>;
    const avatarPl = avatarPlacements[proj.aspectRatio] ?? { x: 0.62, y: 0.35, scale: 1, rotation: 0 };
    const avH = h * 0.6 * avatarPl.scale;
    const avW = (avH * 9) / 16;
    const avatar = new Container();
    avatar.addChild(
      new Graphics().roundRect(0, 0, avW, avH, 10).fill(0x2e4057).stroke({ width: 2, color: 0x4c6a8f }),
      new Text({
        text: `АВАТАР\n${scene.avatarId ?? 'stock'}`,
        style: { fill: 0xdfe6f2, fontSize: 13 * avatarPl.scale, align: 'center' },
      }),
    );
    const label = avatar.children[1] as Text;
    label.position.set(avW / 2 - label.width / 2, avH / 2 - label.height / 2);
    avatar.position.set(avatarPl.x * w, avatarPl.y * h);
    makeDraggable(avatar, (nx, ny) => {
      const st = useEditor.getState();
      const sc = st.project?.scenes.find((s) => s.id === scene.id);
      if (!sc || !st.project) return;
      st.mergeBackground(scene.id, {
        avatarPlacements: {
          ...((sc.background.avatarPlacements ?? {}) as Record<string, LayerPlacement>),
          [st.project.aspectRatio]: { ...avatarPl, x: nx / w, y: ny / h },
        },
      });
    });
    app.stage.addChild(avatar);

    // Текстовые слои
    for (const layer of scene.layers.filter((l) => l.type === 'text')) {
      const pl = placementFor(layer, proj.aspectRatio);
      const node = new Text({
        text: String(layer.props.text ?? ''),
        style: { fill: 0xffffff, fontSize: 28 * pl.scale, fontFamily: 'Inter, sans-serif' },
      });
      node.position.set(pl.x * w, pl.y * h);
      node.angle = pl.rotation;
      node.eventMode = 'static';
      node.cursor = 'pointer';
      node.on('pointerdown', () => useEditor.getState().selectLayer(layer.id));
      makeDraggable(node, (nx, ny) => {
        useEditor.getState().setLayerPlacement(scene.id, layer.id, {
          ...pl,
          x: nx / w,
          y: ny / h,
        });
      });
      app.stage.addChild(node);

      if (layer.id === state.selectedLayerId) {
        const bounds = node.getLocalBounds();
        const outline = new Graphics()
          .rect(-4, -4, bounds.width + 8, bounds.height + 8)
          .stroke({ width: 1.5, color: 0x4c9aff });
        outline.position.copyFrom(node.position);
        outline.angle = node.angle;
        app.stage.addChild(outline);

        // Resize-ручка (правый нижний угол)
        const handle = new Graphics().rect(0, 0, 10, 10).fill(0x4c9aff);
        handle.position.set(node.x + bounds.width + 4, node.y + bounds.height + 4);
        handle.eventMode = 'static';
        handle.cursor = 'nwse-resize';
        let resizing: { startX: number; startScale: number } | null = null;
        handle.on('pointerdown', (e: FederatedPointerEvent) => {
          resizing = { startX: e.globalX, startScale: pl.scale };
          e.stopPropagation();
        });
        app.stage.on('pointermove', (e: FederatedPointerEvent) => {
          if (!resizing) return;
          const scale = Math.min(3, Math.max(0.3, resizing.startScale + (e.globalX - resizing.startX) / 120));
          node.style.fontSize = 28 * scale;
        });
        app.stage.on('pointerup', (e: FederatedPointerEvent) => {
          if (!resizing) return;
          const scale = Math.min(3, Math.max(0.3, resizing.startScale + (e.globalX - resizing.startX) / 120));
          resizing = null;
          useEditor.getState().setLayerPlacement(scene.id, layer.id, { ...pl, scale });
        });
        app.stage.addChild(handle);
      }
    }

    // Safe-zone (пунктир): лицо аватара и ключевой контент всегда в кадре (FR-4.8)
    const sz = new Graphics();
    const m = Math.round(Math.min(w, h) * SAFE_ZONE);
    const dash = 8;
    for (let x = m; x < w - m; x += dash * 2) sz.moveTo(x, m).lineTo(Math.min(x + dash, w - m), m).moveTo(x, h - m).lineTo(Math.min(x + dash, w - m), h - m);
    for (let y = m; y < h - m; y += dash * 2) sz.moveTo(m, y).lineTo(m, Math.min(y + dash, h - m)).moveTo(w - m, y).lineTo(w - m, Math.min(y + dash, h - m));
    sz.stroke({ width: 1, color: 0xffc857, alpha: 0.5 });
    app.stage.addChild(sz);

    function makeDraggable(target: Container, commit: (x: number, y: number) => void): void {
      target.eventMode = 'static';
      target.cursor = 'grab';
      let drag: { dx: number; dy: number } | null = null;
      target.on('pointerdown', (e: FederatedPointerEvent) => {
        drag = { dx: e.globalX - target.x, dy: e.globalY - target.y };
      });
      app!.stage.on('pointermove', (e: FederatedPointerEvent) => {
        if (!drag) return;
        target.position.set(snap(e.globalX - drag.dx), snap(e.globalY - drag.dy));
      });
      app!.stage.on('pointerup', () => {
        if (!drag) return;
        drag = null;
        commit(target.x, target.y);
      });
      app!.stage.on('pointerupoutside', () => {
        if (!drag) return;
        drag = null;
        commit(target.x, target.y);
      });
    }
  }

  return <div ref={hostRef} data-testid="canvas-host" />;
}
