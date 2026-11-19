import { create } from 'zustand';
import { FocusSession, FocusState } from '@/types/focus';
import * as api from '@/services/tauriApi';
import { onEvent } from '@/services/events';

interface FocusStoreState {
  session: FocusSession;
  isLoading: boolean;
  error: string | null;
  fetchSession: () => Promise<void>;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  tick: () => void;
  setDurations: (focusMins: number, breakMins: number) => Promise<void>;
  switchMode: (mode: 'focus' | 'break') => void;
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

  startTimer: () => {
    const { session } = get();
    const nextState: FocusState = session.state === 'idle' || session.state === 'paused' ? 'focus' : session.state;
    const updated: FocusSession = {
      ...session,
      state: nextState,
      is_running: true,
      remaining_seconds: session.remaining_seconds > 0 ? session.remaining_seconds : session.duration_minutes * 60,
    };
    set({ session: updated });
    get().saveCurrentSession();
  },

  pauseTimer: () => {
    const { session } = get();
    const updated: FocusSession = {
      ...session,
      state: 'paused',
      is_running: false,
    };
    set({ session: updated });
    get().saveCurrentSession();
  },

  resetTimer: () => {
    const { session } = get();
    const updated: FocusSession = {
      ...session,
      state: 'idle',
      is_running: false,
      remaining_seconds: session.duration_minutes * 60,
    };
    set({ session: updated });
    get().saveCurrentSession();
  },

  tick: () => {
    const { session } = get();
    if (!session.is_running || session.remaining_seconds <= 0) return;

    const remaining = session.remaining_seconds - 1;

    if (remaining <= 0) {
      // Transition between focus and break
      if (session.state === 'focus') {
        const next: FocusSession = {
          ...session,
          state: 'break',
          remaining_seconds: session.break_minutes * 60,
          is_running: false,
        };
        set({ session: next });
        get().saveCurrentSession();
      } else {
        const next: FocusSession = {
          ...session,
          state: 'idle',
          remaining_seconds: session.duration_minutes * 60,
          is_running: false,
        };
        set({ session: next });
        get().saveCurrentSession();
      }
    } else {
      set({
        session: { ...session, remaining_seconds: remaining },
      });
    }
  },

  switchMode: (mode: 'focus' | 'break') => {
    const { session } = get();
    const duration = mode === 'focus' ? session.duration_minutes : session.break_minutes;
    const updated: FocusSession = {
      ...session,
      state: mode,
      is_running: false,
      remaining_seconds: duration * 60,
    };
    set({ session: updated });
    get().saveCurrentSession();
  },

  setDurations: async (focusMins, breakMins) => {
    const { session } = get();
    const updated: FocusSession = {
      ...session,
      duration_minutes: focusMins,
      break_minutes: breakMins,
      remaining_seconds: focusMins * 60,
      state: 'idle',
      is_running: false,
    };
    set({ session: updated });
    await get().saveCurrentSession();
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
    const unlisten = await onEvent<FocusSession>('focus-updated', (payload) => {
      if (payload && typeof payload === 'object' && typeof payload.remaining_seconds === 'number') {
        set({ session: payload });
      }
    });
    return unlisten;
  },
}));
