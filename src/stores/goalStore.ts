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
    const goal = get().goals.find((g) => g.id === id);
    if (!goal) return;
    const nextCount = goal.current_count + 1;
    const isCompleted = nextCount >= goal.target_count;
    const updated = { ...goal, current_count: nextCount, is_completed: isCompleted };
    try {
      await api.saveGoal(updated);
      set((state) => ({
        goals: state.goals.map((g) => (g.id === id ? updated : g)),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  decrementProgress: async (id) => {
    const goal = get().goals.find((g) => g.id === id);
    if (!goal || goal.current_count <= 0) return;
    const nextCount = goal.current_count - 1;
    const isCompleted = nextCount >= goal.target_count;
    const updated = { ...goal, current_count: nextCount, is_completed: isCompleted };
    try {
      await api.saveGoal(updated);
      set((state) => ({
        goals: state.goals.map((g) => (g.id === id ? updated : g)),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  toggleComplete: async (id) => {
    const goal = get().goals.find((g) => g.id === id);
    if (!goal) return;
    const isCompleted = !goal.is_completed;
    const updated = {
      ...goal,
      is_completed: isCompleted,
      current_count: isCompleted ? Math.max(goal.current_count, goal.target_count) : 0,
    };
    try {
      await api.saveGoal(updated);
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
    const unlisten = await onEvent('goals-updated', () => {
      get().fetchGoals();
    });
    return unlisten;
  },
}));
