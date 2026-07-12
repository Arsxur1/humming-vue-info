import { create } from 'zustand';
import type { AspectRatio, SceneTransition } from '@avatarstudio/shared';
import { api, ApiRequestError } from '../api/client.js';
import type { Layer, ProjectWithScenes, RenderJob, Scene } from '../api/types.js';

/** Позиция слоя, хранится раздельно для каждого формата (мультиформат, FR-4.8). */
export interface LayerPlacement {
  x: number; // 0..1 от ширины кадра
  y: number;
  scale: number;
  rotation: number; // градусы
}

export function placementFor(layer: Layer, aspect: AspectRatio): LayerPlacement {
  const placements = (layer.props.placements ?? {}) as Record<string, LayerPlacement>;
  return placements[aspect] ?? placements['16:9'] ?? { x: 0.1, y: 0.1, scale: 1, rotation: 0 };
}

type SaveState = 'saved' | 'saving' | 'conflict' | 'error';

interface EditorState {
  workspaceId: string | null;
  project: ProjectWithScenes | null;
  selectedSceneId: string | null;
  selectedLayerId: string | null;
  saveState: SaveState;
  lastError: string | null;
  renderJob: RenderJob | null;

  load(workspaceId: string, projectId: string): Promise<void>;
  selectScene(id: string): void;
  selectLayer(id: string | null): void;
  addScene(): Promise<void>;
  removeScene(id: string): Promise<void>;
  reorderScene(id: string, direction: -1 | 1): Promise<void>;
  setScript(sceneId: string, script: string): void;
  setTransition(sceneId: string, transition: SceneTransition): void;
  setBackgroundColor(sceneId: string, color: string): void;
  mergeBackground(sceneId: string, patch: Record<string, unknown>): void;
  addTextLayer(sceneId: string): void;
  updateLayerProps(sceneId: string, layerId: string, props: Record<string, unknown>): void;
  setLayerPlacement(sceneId: string, layerId: string, placement: LayerPlacement): void;
  removeLayer(sceneId: string, layerId: string): void;
  setAspect(aspect: AspectRatio): Promise<void>;
  flushScene(sceneId: string): Promise<void>;
  startRender(quality: '720p' | '1080p'): Promise<RenderJob>;
  startScenePreview(sceneId: string): Promise<RenderJob>;
  refreshRenderJob(): Promise<void>;
  clearRenderJob(): void;
}

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const AUTOSAVE_MS = 800;

export const useEditor = create<EditorState>((set, get) => {
  function mutateScene(sceneId: string, patch: Partial<Scene>): void {
    const project = get().project;
    if (!project) return;
    set({
      project: {
        ...project,
        scenes: project.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)),
      },
    });
    scheduleSave(sceneId);
  }

  function scheduleSave(sceneId: string): void {
    clearTimeout(saveTimers.get(sceneId));
    saveTimers.set(
      sceneId,
      setTimeout(() => void get().flushScene(sceneId), AUTOSAVE_MS),
    );
    set({ saveState: 'saving' });
  }

  /** Добить все отложенные автосохранения — обязательно перед перезагрузкой проекта. */
  async function flushPending(): Promise<void> {
    const pending = [...saveTimers.keys()];
    for (const id of pending) {
      clearTimeout(saveTimers.get(id));
      saveTimers.delete(id);
      await get().flushScene(id);
    }
  }

  return {
    workspaceId: null,
    project: null,
    selectedSceneId: null,
    selectedLayerId: null,
    saveState: 'saved',
    lastError: null,
    renderJob: null,

    async load(workspaceId, projectId) {
      const project = await api<ProjectWithScenes>(
        'GET',
        `/api/workspaces/${workspaceId}/projects/${projectId}`,
      );
      set({
        workspaceId,
        project,
        selectedSceneId: project.scenes[0]?.id ?? null,
        selectedLayerId: null,
        saveState: 'saved',
        renderJob: null,
      });
    },

    selectScene(id) {
      set({ selectedSceneId: id, selectedLayerId: null });
    },

    selectLayer(id) {
      set({ selectedLayerId: id });
    },

    async addScene() {
      const { workspaceId, project } = get();
      if (!workspaceId || !project) return;
      await flushPending();
      await api('POST', `/api/workspaces/${workspaceId}/projects/${project.id}/scenes`, {
        script: '',
        layers: [],
      });
      await get().load(workspaceId, project.id);
      const scenes = get().project?.scenes ?? [];
      set({ selectedSceneId: scenes[scenes.length - 1]?.id ?? null });
    },

    async removeScene(id) {
      const { workspaceId, project } = get();
      if (!workspaceId || !project) return;
      await flushPending();
      await api('DELETE', `/api/workspaces/${workspaceId}/projects/${project.id}/scenes/${id}`);
      await get().load(workspaceId, project.id);
    },

    async reorderScene(id, direction) {
      const { workspaceId, project } = get();
      if (!workspaceId || !project) return;
      await flushPending();
      const ids = project.scenes.map((s) => s.id);
      const idx = ids.indexOf(id);
      const target = idx + direction;
      if (target < 0 || target >= ids.length) return;
      [ids[idx], ids[target]] = [ids[target]!, ids[idx]!];
      await api('POST', `/api/workspaces/${workspaceId}/projects/${project.id}/scenes/reorder`, {
        sceneIds: ids,
      });
      await get().load(workspaceId, project.id);
      set({ selectedSceneId: id });
    },

    setScript(sceneId, script) {
      mutateScene(sceneId, { script });
    },

    setTransition(sceneId, transition) {
      mutateScene(sceneId, { transition });
    },

    setBackgroundColor(sceneId, color) {
      const scene = get().project?.scenes.find((s) => s.id === sceneId);
      mutateScene(sceneId, { background: { ...(scene?.background ?? {}), type: 'color', color } });
    },

    mergeBackground(sceneId, patch) {
      const scene = get().project?.scenes.find((s) => s.id === sceneId);
      if (!scene) return;
      mutateScene(sceneId, { background: { ...scene.background, ...patch } });
    },

    addTextLayer(sceneId) {
      const project = get().project;
      const scene = project?.scenes.find((s) => s.id === sceneId);
      if (!scene) return;
      const layer: Layer = {
        id: `local-${Date.now()}`,
        sceneId,
        type: 'text',
        zIndex: scene.layers.length + 1,
        props: {
          text: 'Новый текст',
          placements: { [project!.aspectRatio]: { x: 0.1, y: 0.1, scale: 1, rotation: 0 } },
        },
        startMs: null,
        endMs: null,
        keyframes: null,
      };
      mutateScene(sceneId, { layers: [...scene.layers, layer] });
      set({ selectedLayerId: layer.id });
    },

    updateLayerProps(sceneId, layerId, props) {
      const scene = get().project?.scenes.find((s) => s.id === sceneId);
      if (!scene) return;
      mutateScene(sceneId, {
        layers: scene.layers.map((l) =>
          l.id === layerId ? { ...l, props: { ...l.props, ...props } } : l,
        ),
      });
    },

    setLayerPlacement(sceneId, layerId, placement) {
      const { project } = get();
      const scene = project?.scenes.find((s) => s.id === sceneId);
      const layer = scene?.layers.find((l) => l.id === layerId);
      if (!project || !layer) return;
      const placements = {
        ...((layer.props.placements ?? {}) as Record<string, LayerPlacement>),
        [project.aspectRatio]: placement,
      };
      get().updateLayerProps(sceneId, layerId, { placements });
    },

    removeLayer(sceneId, layerId) {
      const scene = get().project?.scenes.find((s) => s.id === sceneId);
      if (!scene) return;
      mutateScene(sceneId, { layers: scene.layers.filter((l) => l.id !== layerId) });
      set({ selectedLayerId: null });
    },

    async setAspect(aspect) {
      const { workspaceId, project } = get();
      if (!workspaceId || !project) return;
      await api('PATCH', `/api/workspaces/${workspaceId}/projects/${project.id}`, {
        aspectRatio: aspect,
      });
      set({ project: { ...project, aspectRatio: aspect } });
    },

    /** Автосохранение с оптимистической блокировкой; 409 → перезагрузка сцены. */
    async flushScene(sceneId) {
      clearTimeout(saveTimers.get(sceneId));
      saveTimers.delete(sceneId);
      const { workspaceId, project } = get();
      const scene = project?.scenes.find((s) => s.id === sceneId);
      if (!workspaceId || !project || !scene) return;
      try {
        const updated = await api<Scene>(
          'PATCH',
          `/api/workspaces/${workspaceId}/projects/${project.id}/scenes/${sceneId}`,
          {
            expectedVersion: scene.version,
            script: scene.script,
            transition: scene.transition,
            background: scene.background,
            layers: scene.layers.map((l) => ({
              type: l.type,
              zIndex: l.zIndex,
              props: l.props,
              startMs: l.startMs,
              endMs: l.endMs,
              keyframes: null,
            })),
          },
        );
        // после replace слоёв сервер выдал новые id — перечитываем сцену целиком
        const fresh = await api<ProjectWithScenes>(
          'GET',
          `/api/workspaces/${workspaceId}/projects/${project.id}`,
        );
        const current = get().project;
        if (current) {
          set({
            project: {
              ...current,
              scenes: current.scenes.map((s) =>
                s.id === sceneId
                  ? { ...(fresh.scenes.find((f) => f.id === sceneId) ?? s), script: s.script }
                  : s,
              ),
            },
            saveState: 'saved',
          });
          // версию берём из ответа PATCH (fresh мог не успеть)
          mutateSceneVersion(sceneId, updated.version);
        }
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 409) {
          set({ saveState: 'conflict', lastError: err.error.message });
          await get().load(workspaceId, project.id);
        } else {
          set({ saveState: 'error', lastError: (err as Error).message });
        }
      }

      function mutateSceneVersion(id: string, version: number): void {
        const p = get().project;
        if (!p) return;
        set({
          project: {
            ...p,
            scenes: p.scenes.map((s) => (s.id === id ? { ...s, version } : s)),
          },
        });
      }
    },

    async startRender(quality) {
      const { workspaceId, project } = get();
      if (!workspaceId || !project) throw new Error('нет проекта');
      // добиваем незаписанные правки
      for (const scene of project.scenes) await get().flushScene(scene.id);
      const res = await api<{ jobId: string }>(
        'POST',
        `/api/workspaces/${workspaceId}/projects/${project.id}/renders`,
        { quality },
      );
      const job = await api<RenderJob>(
        'GET',
        `/api/workspaces/${workspaceId}/renders/${res.jobId}`,
      );
      set({ renderJob: job });
      return job;
    },

    async startScenePreview(sceneId) {
      const { workspaceId, project } = get();
      if (!workspaceId || !project) throw new Error('нет проекта');
      await get().flushScene(sceneId);
      const res = await api<{ jobId: string }>(
        'POST',
        `/api/workspaces/${workspaceId}/projects/${project.id}/scenes/${sceneId}/preview`,
      );
      const job = await api<RenderJob>(
        'GET',
        `/api/workspaces/${workspaceId}/renders/${res.jobId}`,
      );
      set({ renderJob: job });
      return job;
    },

    async refreshRenderJob() {
      const { workspaceId, renderJob } = get();
      if (!workspaceId || !renderJob) return;
      const job = await api<RenderJob>(
        'GET',
        `/api/workspaces/${workspaceId}/renders/${renderJob.id}`,
      );
      set({ renderJob: job });
    },

    clearRenderJob() {
      set({ renderJob: null });
    },
  };
});
