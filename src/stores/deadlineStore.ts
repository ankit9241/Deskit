import { create } from 'zustand';
import { Deadline } from '@/types/deadline';
import * as api from '@/services/tauriApi';
import { onEvent } from '@/services/events';

interface DeadlineState {
  deadlines: Deadline[];
  isLoading: boolean;
  error: string | null;
  fetchDeadlines: () => Promise<void>;
  addDeadline: (
    title: string,
    dueDate: string,
    category?: string,
    notifyLeadMinutes?: number
  ) => Promise<void>;
  updateDeadline: (deadline: Deadline) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  deleteDeadline: (id: string) => Promise<void>;
  initListeners: () => Promise<() => void>;
}

export const useDeadlineStore = create<DeadlineState>((set, get) => ({
  deadlines: [],
  isLoading: false,
  error: null,

  fetchDeadlines: async () => {
    set({ isLoading: true, error: null });
    try {
      const deadlines = await api.getDeadlines();
      set({ deadlines, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  addDeadline: async (title, dueDate, category = 'General', notifyLeadMinutes = 15) => {
    try {
      const newDeadline = await api.saveDeadline({
        title,
        due_date: dueDate,
        category,
        is_completed: false,
        notify_lead_minutes: notifyLeadMinutes,
        notified_lead: false,
        notified_due: false,
      });
      set((state) => {
        const existingIdx = state.deadlines.findIndex((d) => d.id === newDeadline.id);
        if (existingIdx >= 0) {
          const updatedList = [...state.deadlines];
          updatedList[existingIdx] = newDeadline;
          return { deadlines: updatedList };
        }
        return { deadlines: [...state.deadlines, newDeadline] };
      });
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  updateDeadline: async (deadline) => {
    try {
      const saved = await api.saveDeadline(deadline);
      set((state) => ({
        deadlines: state.deadlines.map((d) => (d.id === saved.id ? saved : d)),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  toggleComplete: async (id) => {
    const item = get().deadlines.find((d) => d.id === id);
    if (!item) return;
    const updated = {
      ...item,
      is_completed: !item.is_completed,
    };
    try {
      const saved = await api.saveDeadline(updated);
      set((state) => ({
        deadlines: state.deadlines.map((d) => (d.id === id ? saved : d)),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  deleteDeadline: async (id) => {
    try {
      await api.deleteDeadline(id);
      set((state) => ({
        deadlines: state.deadlines.filter((d) => d.id !== id),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  initListeners: async () => {
    const unlisten = await onEvent('deadlines-updated', () => {
      get().fetchDeadlines();
    });
    return unlisten;
  },
}));
