import { create } from 'zustand';
import { WorldClock, Alarm, RingingAlarm } from '@/types/clock';
import * as api from '@/services/tauriApi';
import { onEvent } from '@/services/events';

interface ClockState {
  worldClocks: WorldClock[];
  alarms: Alarm[];
  ringingAlarm: RingingAlarm | null;
  isLoading: boolean;
  error: string | null;

  fetchClockData: () => Promise<void>;
  addWorldClock: (cityName: string, timezone: string) => Promise<void>;
  removeWorldClock: (id: string) => Promise<void>;
  saveAlarm: (alarm: Alarm) => Promise<void>;
  toggleAlarm: (id: string) => Promise<void>;
  deleteAlarm: (id: string) => Promise<void>;
  dismissAlarm: (id?: string) => Promise<void>;
  initListeners: () => Promise<() => void>;
}

export const useClockStore = create<ClockState>((set) => ({
  worldClocks: [],
  alarms: [],
  ringingAlarm: null,
  isLoading: false,
  error: null,

  fetchClockData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [worldClocks, alarms, ringingId] = await Promise.all([
        api.getWorldClocks(),
        api.getAlarms(),
        api.getActiveRingingAlarm(),
      ]);
      let activeRinging: RingingAlarm | null = null;
      if (ringingId) {
        const found = alarms.find((a) => a.id === ringingId);
        if (found) {
          activeRinging = { id: found.id, title: found.title, time_str: found.time_str };
        }
      }
      set({ worldClocks, alarms, ringingAlarm: activeRinging, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  addWorldClock: async (cityName: string, timezone: string) => {
    try {
      const newClock = await api.saveWorldClock({
        id: '',
        city_name: cityName.trim(),
        timezone: timezone.trim(),
        sort_order: 0,
      });
      set((state) => ({ worldClocks: [...state.worldClocks, newClock] }));
    } catch (err: unknown) {
      set({ error: String(err) });
      throw err;
    }
  },

  removeWorldClock: async (id: string) => {
    try {
      await api.deleteWorldClock(id);
      set((state) => ({
        worldClocks: state.worldClocks.filter((c) => c.id !== id),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  saveAlarm: async (alarm: Alarm) => {
    try {
      const saved = await api.saveAlarm(alarm);
      set((state) => {
        const exists = state.alarms.some((a) => a.id === saved.id);
        return {
          alarms: exists
            ? state.alarms.map((a) => (a.id === saved.id ? saved : a))
            : [...state.alarms, saved],
        };
      });
    } catch (err: unknown) {
      set({ error: String(err) });
      throw err;
    }
  },

  toggleAlarm: async (id: string) => {
    try {
      const updated = await api.toggleAlarm(id);
      set((state) => ({
        alarms: state.alarms.map((a) => (a.id === id ? updated : a)),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  deleteAlarm: async (id: string) => {
    try {
      await api.deleteAlarm(id);
      set((state) => ({
        alarms: state.alarms.filter((a) => a.id !== id),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  dismissAlarm: async (id?: string) => {
    try {
      await api.dismissAlarm(id);
      set({ ringingAlarm: null });
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  initListeners: async () => {
    const unlistenClocks = await onEvent<WorldClock>('world-clocks-updated', () => {
      api.getWorldClocks().then((clocks) => set({ worldClocks: clocks }));
    });

    const unlistenClockDeleted = await onEvent<string>('world-clock-deleted', (id) => {
      set((state) => ({ worldClocks: state.worldClocks.filter((c) => c.id !== id) }));
    });

    const unlistenAlarms = await onEvent<Alarm>('alarms-updated', () => {
      api.getAlarms().then((alarms) => set({ alarms }));
    });

    const unlistenAlarmTriggered = await onEvent<RingingAlarm>('alarm-triggered', (alarm) => {
      set({ ringingAlarm: alarm });
    });

    const unlistenAlarmDismissed = await onEvent<string | null>('alarm-dismissed', () => {
      set({ ringingAlarm: null });
    });

    return () => {
      unlistenClocks();
      unlistenClockDeleted();
      unlistenAlarms();
      unlistenAlarmTriggered();
      unlistenAlarmDismissed();
    };
  },
}));
