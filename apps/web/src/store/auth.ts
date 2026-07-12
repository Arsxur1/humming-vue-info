import { create } from 'zustand';
import { api, getTokens, setTokens } from '../api/client.js';
import type { AuthResponse, User, WorkspaceListItem } from '../api/types.js';

interface AuthState {
  user: User | null;
  workspace: WorkspaceListItem | null;
  loading: boolean;
  init(): Promise<void>;
  register(email: string, password: string, name: string): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): void;
  ensureWorkspace(): Promise<WorkspaceListItem>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  workspace: null,
  loading: true,

  async init() {
    if (!getTokens()) {
      set({ loading: false });
      return;
    }
    try {
      const user = await api<User>('GET', '/api/auth/me');
      set({ user, loading: false });
      await get().ensureWorkspace();
    } catch {
      setTokens(null);
      set({ user: null, loading: false });
    }
  },

  async register(email, password, name) {
    const res = await api<AuthResponse>('POST', '/api/auth/register', { email, password, name });
    setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    set({ user: res.user });
    await get().ensureWorkspace();
  },

  async login(email, password) {
    const res = await api<AuthResponse>('POST', '/api/auth/login', { email, password });
    setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    set({ user: res.user });
    await get().ensureWorkspace();
  },

  logout() {
    setTokens(null);
    set({ user: null, workspace: null });
  },

  /** Личный workspace: берём первый или создаём. */
  async ensureWorkspace() {
    const existing = get().workspace;
    if (existing) return existing;
    const list = await api<WorkspaceListItem[]>('GET', '/api/workspaces');
    let ws = list[0] ?? null;
    if (!ws) {
      const created = await api<{ id: string; name: string }>('POST', '/api/workspaces', {
        name: `Студия ${get().user?.name ?? ''}`.trim(),
      });
      ws = { id: created.id, name: created.name, role: 'owner', createdAt: '' };
    }
    set({ workspace: ws });
    return ws;
  },
}));
