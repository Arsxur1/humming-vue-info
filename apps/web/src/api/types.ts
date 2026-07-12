import type { AspectRatio, LayerType, Role, SceneTransition } from '@avatarstudio/shared';

export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface WorkspaceListItem {
  id: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  title: string;
  aspectRatio: AspectRatio;
  defaultLanguage: string;
  updatedAt: string;
}

export interface Layer {
  id: string;
  sceneId: string;
  type: LayerType;
  zIndex: number;
  props: Record<string, unknown>;
  startMs: number | null;
  endMs: number | null;
  keyframes: unknown;
}

export interface Scene {
  id: string;
  projectId: string;
  orderIndex: number;
  script: string;
  language: string | null;
  voiceId: string | null;
  avatarId: string | null;
  background: Record<string, unknown>;
  durationMs: number | null;
  transition: SceneTransition;
  contentHash: string;
  version: number;
  layers: Layer[];
}

export interface ProjectWithScenes extends Project {
  scenes: Scene[];
}

export interface RenderJob {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  stage: string;
  progress: number;
  errorMessage: string | null;
  creditsReserved: string;
  creditsCharged: string | null;
  durationMs: number | null;
  outputUrl?: string | null;
  meta: Record<string, unknown>;
}
