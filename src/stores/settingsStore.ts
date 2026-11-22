import { create } from 'zustand';
import { AppSettings } from '@/types/settings';
import * as api from '@/services/tauriApi';
import { onEvent } from '@/services/events';

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;
  fetchSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  toggleAutostart: () => Promise<void>;
  toggleCloseToTray: () => Promise<void>;
  toggleTimeFormat: () => Promise<void>;
  toggleSeconds: () => Promise<void>;
  initListeners: () => Promise<() => void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    launch_at_login: true,
    close_to_tray: true,
    time_format_24h: false,
    show_seconds: true,
    default_visibility_mode: 'always_on_top',
    theme: 'dark',
  },
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const settings = await api.getSettings();
      set({ settings, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  updateSettings: async (partial) => {
    const current = get().settings;
    const updated = { ...current, ...partial };
    try {
      const saved = await api.saveSettings(updated);
      set({ settings: saved });
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  toggleAutostart: async () => {
    const current = get().settings.launch_at_login;
    await get().updateSettings({ launch_at_login: !current });
  },

  toggleCloseToTray: async () => {
    const current = get().settings.close_to_tray;
    await get().updateSettings({ close_to_tray: !current });
  },

  toggleTimeFormat: async () => {
    const current = get().settings.time_format_24h;
    await get().updateSettings({ time_format_24h: !current });
  },

  toggleSeconds: async () => {
    const current = get().settings.show_seconds;
    await get().updateSettings({ show_seconds: !current });
  },

  initListeners: async () => {
    const unlisten = await onEvent<AppSettings>('settings-updated', (payload) => {
      set({ settings: payload });
    });
    return unlisten;
  },
}));
