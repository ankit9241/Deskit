import { create } from 'zustand';
import { WidgetInstance, WidgetType, VisibilityMode } from '@/types/widget';
import * as api from '@/services/tauriApi';
import { onEvent } from '@/services/events';

interface WidgetState {
  widgets: WidgetInstance[];
  isLoading: boolean;
  error: string | null;
  fetchWidgets: () => Promise<void>;
  pinWidget: (widgetType: WidgetType, title?: string) => Promise<WidgetInstance | null>;
  unpinWidget: (widgetId: string) => Promise<void>;
  removeWidget: (widgetId: string) => Promise<void>;
  setVisibilityMode: (widgetId: string, mode: VisibilityMode) => Promise<void>;
  toggleCollapse: (widgetId: string) => Promise<void>;
  initListeners: () => Promise<() => void>;
}

export const useWidgetStore = create<WidgetState>((set, get) => ({
  widgets: [],
  isLoading: false,
  error: null,

  fetchWidgets: async () => {
    set({ isLoading: true, error: null });
    try {
      const widgets = await api.getWidgets();
      set({ widgets, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  pinWidget: async (widgetType, title) => {
    try {
      set({ error: null });
      const instance = await api.pinWidget(widgetType, title);
      try {
        await get().fetchWidgets();
      } catch {
        // Non-fatal background refresh
      }
      return instance;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to pin widget:', errMsg);
      set({ error: errMsg });
      return null;
    }
  },

  unpinWidget: async (widgetId) => {
    try {
      await api.unpinWidget(widgetId);
      await get().fetchWidgets();
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  removeWidget: async (widgetId) => {
    try {
      await api.removeWidget(widgetId);
      set((state) => ({
        widgets: state.widgets.filter((w) => w.id !== widgetId),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  setVisibilityMode: async (widgetId, mode) => {
    try {
      await api.setWidgetVisibility(widgetId, mode);
      set((state) => ({
        widgets: state.widgets.map((w) =>
          w.id === widgetId ? { ...w, visibility_mode: mode } : w
        ),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  toggleCollapse: async (widgetId) => {
    const widget = get().widgets.find((w) => w.id === widgetId);
    if (!widget) return;
    const newCollapsed = !widget.is_collapsed;
    try {
      await api.toggleCollapseWidget(widgetId, newCollapsed);
      set((state) => ({
        widgets: state.widgets.map((w) =>
          w.id === widgetId ? { ...w, is_collapsed: newCollapsed } : w
        ),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  initListeners: async () => {
    const unlisten1 = await onEvent('widget-updated', () => {
      get().fetchWidgets();
    });
    const unlisten2 = await onEvent('widget-removed', () => {
      get().fetchWidgets();
    });
    const unlisten3 = await onEvent('widgets-updated', () => {
      get().fetchWidgets();
    });
    const unlisten4 = await onEvent('workspace-switched', () => {
      get().fetchWidgets();
    });
    return () => {
      unlisten1();
      unlisten2();
      unlisten3();
      unlisten4();
    };
  },
}));
