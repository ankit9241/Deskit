import { create } from 'zustand';
import { DailyGoal } from '@/types/goal';
import * as api from '@/services/tauriApi';
import { onEvent } from '@/services/events';

interface GoalState {
  goals: DailyGoal[];
  isLoading: boolean;
  error: string | null;
  fetchGoals: () => Promise<void>;
  addGoal: (title: string, targetCount?: number) => Promise<void>;
  incrementProgress: (id: string) => Promise<void>;
  decrementProgress: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  initListeners: () => Promise<() => void>;
}

export const useGoalStore = create<GoalState>((set, get) => ({
  goals: [],
  isLoading: false,
  error: null,

  fetchGoals: async () => {
    set({ isLoading: true, error: null });
    try {
      const goals = await api.getGoals();
      set({ goals, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  addGoal: async (title, targetCount = 1) => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const newGoal = await api.saveGoal({
        title,
        target_count: targetCount,
        current_count: 0,
        is_completed: false,
        date_str: today,
      });
      set((state) => ({ goals: [...state.goals, newGoal] }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  incrementProgress: async (id) => {
    try {
      const updated = await api.incrementGoal(id);
      set((state) => ({
        goals: state.goals.map((g) => (g.id === id ? updated : g)),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  decrementProgress: async (id) => {
    try {
      const updated = await api.decrementGoal(id);
      set((state) => ({
        goals: state.goals.map((g) => (g.id === id ? updated : g)),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  toggleComplete: async (id) => {
    try {
      const updated = await api.toggleGoal(id);
      set((state) => ({
        goals: state.goals.map((g) => (g.id === id ? updated : g)),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  deleteGoal: async (id) => {
    try {
      await api.deleteGoal(id);
      set((state) => ({
        goals: state.goals.filter((g) => g.id !== id),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  initListeners: async () => {
    let lastDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
    const dateInterval = setInterval(() => {
      const currentDate = new Date().toLocaleDateString('en-CA');
      if (currentDate !== lastDate) {
        lastDate = currentDate;
        get().fetchGoals();
      }
    }, 15000);

    const unlisten = await onEvent('goals-updated', () => {
      get().fetchGoals();
    });

    return () => {
      clearInterval(dateInterval);
      unlisten();
    };
  },
}));
