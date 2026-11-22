import { create } from 'zustand';
import { Workspace } from '@/types/workspace';
import * as api from '@/services/tauriApi';
import { onEvent } from '@/services/events';

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;
  fetchWorkspaces: () => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  saveCurrentWorkspace: (name: string, description?: string) => Promise<Workspace>;
  deleteWorkspace: (id: string) => Promise<void>;
  initListeners: () => Promise<() => void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspace: null,
  isLoading: false,
  error: null,

  fetchWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const [workspaces, activeWorkspace] = await Promise.all([
        api.getWorkspaces(),
        api.getActiveWorkspace(),
      ]);
      set({ workspaces, activeWorkspace, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  switchWorkspace: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const switched = await api.switchWorkspace(id);
      const workspaces = await api.getWorkspaces();
      set({ activeWorkspace: switched, workspaces, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  saveCurrentWorkspace: async (name: string, description?: string) => {
    set({ isLoading: true, error: null });
    try {
      const saved = await api.saveCurrentWorkspace(undefined, name, description);
      const workspaces = await api.getWorkspaces();
      set({ activeWorkspace: saved, workspaces, isLoading: false });
      return saved;
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
      throw err;
    }
  },

  deleteWorkspace: async (id: string) => {
    try {
      await api.deleteWorkspace(id);
      const workspaces = await api.getWorkspaces();
      set((state) => ({
        workspaces,
        activeWorkspace:
          state.activeWorkspace?.id === id
            ? workspaces.find((w) => w.is_active) || null
            : state.activeWorkspace,
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  initListeners: async () => {
    const unlistenSwitched = await onEvent<Workspace>('workspace-switched', (workspace) => {
      set((state) => ({
        activeWorkspace: workspace,
        workspaces: state.workspaces.map((w) => ({
          ...w,
          is_active: w.id === workspace.id,
        })),
      }));
    });

    const unlistenUpdated = await onEvent<Workspace>('workspace-updated', (workspace) => {
      set((state) => {
        const exists = state.workspaces.some((w) => w.id === workspace.id);
        const workspaces = exists
          ? state.workspaces.map((w) => (w.id === workspace.id ? workspace : w))
          : [workspace, ...state.workspaces];
        return {
          workspaces,
          activeWorkspace: workspace.is_active ? workspace : state.activeWorkspace,
        };
      });
    });

    const unlistenDeleted = await onEvent<string>('workspace-deleted', (id) => {
      set((state) => ({
        workspaces: state.workspaces.filter((w) => w.id !== id),
      }));
    });

    return () => {
      unlistenSwitched();
      unlistenUpdated();
      unlistenDeleted();
    };
  },
}));
