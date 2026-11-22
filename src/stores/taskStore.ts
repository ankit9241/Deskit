import { create } from 'zustand';
import { Task, TaskPriority } from '@/types/task';
import * as api from '@/services/tauriApi';
import { onEvent } from '@/services/events';

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  fetchTasks: () => Promise<void>;
  addTask: (title: string, priority?: TaskPriority, dueDate?: string, description?: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  initListeners: () => Promise<() => void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await api.getTasks();
      set({ tasks, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  addTask: async (title, priority = 'medium', dueDate, description) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      const newTask = await api.saveTask({
        title: trimmed,
        priority,
        is_completed: false,
        due_date: dueDate ? dueDate.trim() : undefined,
        description: description ? description.trim() : undefined,
      });
      set((state) => ({ tasks: [newTask, ...state.tasks] }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  toggleComplete: async (id) => {
    try {
      const updated = await api.toggleTask(id);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  updateTask: async (task) => {
    const trimmed = task.title.trim();
    if (!trimmed) return;
    try {
      const updated = await api.saveTask({
        ...task,
        title: trimmed,
        due_date: task.due_date ? task.due_date.trim() : undefined,
        description: task.description ? task.description.trim() : undefined,
      });
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === task.id ? updated : t)),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  deleteTask: async (id) => {
    try {
      await api.deleteTask(id);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  initListeners: async () => {
    let lastDate = new Date().toLocaleDateString('en-CA');
    const interval = setInterval(() => {
      const currentDate = new Date().toLocaleDateString('en-CA');
      if (currentDate !== lastDate) {
        lastDate = currentDate;
        get().fetchTasks();
      }
    }, 15000);

    const unlisten = await onEvent('tasks-updated', () => {
      get().fetchTasks();
    });

    return () => {
      clearInterval(interval);
      unlisten();
    };
  },
}));
