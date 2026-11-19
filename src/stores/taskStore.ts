import { create } from 'zustand';
import { Task, TaskPriority } from '@/types/task';
import * as api from '@/services/tauriApi';
import { onEvent } from '@/services/events';

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  fetchTasks: () => Promise<void>;
  addTask: (title: string, priority?: TaskPriority, dueDate?: string) => Promise<void>;
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

  addTask: async (title, priority = 'medium', dueDate) => {
    try {
      const newTask = await api.saveTask({
        title,
        priority,
        is_completed: false,
        due_date: dueDate,
        description: '',
      });
      set((state) => ({ tasks: [newTask, ...state.tasks] }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  toggleComplete: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const updated = { ...task, is_completed: !task.is_completed };
    try {
      await api.saveTask(updated);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  updateTask: async (task) => {
    try {
      await api.saveTask(task);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
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
    const unlisten = await onEvent('tasks-updated', () => {
      get().fetchTasks();
    });
    return unlisten;
  },
}));
