import { create } from 'zustand';
import { FocusSession } from '@/types/focus';
import * as api from '@/services/tauriApi';
import { onEvent } from '@/services/events';

interface FocusStoreState {
  session: FocusSession;
  isLoading: boolean;
  error: string | null;
  fetchSession: () => Promise<void>;
  startTimer: () => Promise<void>;
  pauseTimer: () => Promise<void>;
  resetTimer: () => Promise<void>;
  addMinutes: (minutes: number) => Promise<void>;
  tick: () => void;
  setDurations: (focusMins: number, breakMins: number) => Promise<void>;
  switchMode: (mode: 'focus' | 'break') => Promise<void>;
  saveCurrentSession: () => Promise<void>;
  initListeners: () => Promise<() => void>;
}

const DEFAULT_FOCUS: FocusSession = {
  id: 'default',
  duration_minutes: 25,
  break_minutes: 5,
  state: 'idle',
  remaining_seconds: 25 * 60,
  is_running: false,
  updated_at: new Date().toISOString(),
  ends_at: null,
};

export const useFocusStore = create<FocusStoreState>((set, get) => ({
  session: DEFAULT_FOCUS,
  isLoading: false,
  error: null,

  fetchSession: async () => {
    set({ isLoading: true, error: null });
    try {
      const session = await api.getFocusSession();
      if (session && typeof session === 'object' && typeof session.remaining_seconds === 'number') {
        set({ session, isLoading: false });
      } else {
        set({ session: DEFAULT_FOCUS, isLoading: false });
      }
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  startTimer: async () => {
    try {
      const session = await api.startFocusTimer();
      set({ session });
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  pauseTimer: async () => {
    try {
      const session = await api.pauseFocusTimer();
      set({ session });
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  resetTimer: async () => {
    try {
      const session = await api.resetFocusTimer();
      set({ session });
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  addMinutes: async (minutes: number) => {
    try {
      const session = await api.addFocusMinutes(minutes);
      set({ session });
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  tick: () => {
    const { session } = get();
    if (!session.is_running) return;

    if (session.ends_at) {
      const targetTime = new Date(session.ends_at).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((targetTime - now) / 1000));

      if (remaining <= 0) {
        api.tickFocusTimer().then((s) => {
          if (s) set({ session: s });
        }).catch(() => {});
      } else if (remaining !== session.remaining_seconds) {
        set({
          session: { ...session, remaining_seconds: remaining },
        });
      }
    } else {
      const rem = session.remaining_seconds - 1;
      if (rem <= 0) {
        api.tickFocusTimer().then((s) => {
          if (s) set({ session: s });
        }).catch(() => {});
      } else {
        set({
          session: { ...session, remaining_seconds: rem },
        });
      }
    }
  },

  switchMode: async (mode: 'focus' | 'break') => {
    try {
      const session = await api.switchFocusMode(mode);
      set({ session });
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  setDurations: async (focusMins: number, breakMins: number) => {
    try {
      const session = await api.setFocusDurations(focusMins, breakMins);
      set({ session });
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  saveCurrentSession: async () => {
    const { session } = get();
    try {
      await api.saveFocusSession(session);
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  initListeners: async () => {
    const unlistenUpdated = await onEvent<FocusSession>('focus-updated', (payload) => {
      if (payload && typeof payload === 'object' && typeof payload.remaining_seconds === 'number') {
        set({ session: payload });
      }
    });

    return () => {
      unlistenUpdated();
    };
  },
}));
