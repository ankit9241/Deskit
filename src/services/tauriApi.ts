import { WidgetInstance, VisibilityMode, WidgetType } from '@/types/widget';
import { Task } from '@/types/task';
import { Note } from '@/types/note';
import { FocusSession } from '@/types/focus';
import { Deadline } from '@/types/deadline';
import { DailyGoal } from '@/types/goal';
import { AppSettings } from '@/types/settings';
import { emitLocalEvent } from './events';

/**
 * Bulletproof check for Tauri 2 runtime environment.
 * Evaluates true ONLY when Tauri IPC invoke function is accessible.
 * In a standard web browser (Chrome/Edge/Firefox), this always returns false.
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  const internals = (window as any).__TAURI_INTERNALS__;
  if (internals && typeof internals.invoke === 'function') return true;
  const globalTauri = (window as any).__TAURI__;
  if (globalTauri?.core && typeof globalTauri.core.invoke === 'function') return true;
  return false;
}

/**
 * Safely invokes a native Tauri command.
 * Directly calls Tauri 2 IPC without risky dynamic imports that can stall in Vite dev mode.
 */
async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof window !== 'undefined') {
    const internals = (window as any).__TAURI_INTERNALS__;
    if (internals && typeof internals.invoke === 'function') {
      return await internals.invoke(cmd, args);
    }
    const globalTauri = (window as any).__TAURI__;
    if (globalTauri?.core && typeof globalTauri.core.invoke === 'function') {
      return await globalTauri.core.invoke(cmd, args);
    }
  }
  throw new Error(`[safeInvoke] Tauri native runtime unavailable for command "${cmd}"`);
}

// ---------------- LOCAL STORAGE BROWSER MOCK REPOSITORY ----------------
function getStorage<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw === 'null' || raw === 'undefined') return defaultVal;
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? (parsed as T) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setStorage<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

const DEFAULT_SETTINGS: AppSettings = {
  launch_at_login: false,
  close_to_tray: true,
  time_format_24h: true,
  default_visibility_mode: 'always_on_top',
  theme: 'dark',
};

const DEFAULT_FOCUS: FocusSession = {
  id: 'default',
  duration_minutes: 25,
  break_minutes: 5,
  state: 'idle',
  remaining_seconds: 25 * 60,
  is_running: false,
  updated_at: new Date().toISOString(),
};

// ---------------- WINDOW CONTROLS ----------------
export async function startDragging(): Promise<void> {
  if (isTauri()) {
    await safeInvoke('start_dragging');
  }
}

export async function minimizeWindow(): Promise<void> {
  if (isTauri()) {
    await safeInvoke('minimize_window');
  }
}

export async function hideWindow(): Promise<void> {
  if (isTauri()) {
    await safeInvoke('hide_window');
  } else {
    window.blur();
  }
}

export async function closeWindow(): Promise<void> {
  if (isTauri()) {
    await safeInvoke('close_window');
  } else {
    window.close();
  }
}

export async function setNativeTopmost(enable: boolean): Promise<void> {
  if (isTauri()) {
    await safeInvoke('set_native_topmost', { enable });
  }
}

export async function setWindowSize(width: number, height: number): Promise<void> {
  if (isTauri()) {
    await safeInvoke('set_window_size', { width, height });
  } else {
    try {
      window.resizeTo(width, height);
    } catch {}
  }
}

// ---------------- WIDGETS ----------------
export async function getWidgets(): Promise<WidgetInstance[]> {
  if (isTauri()) {
    return await safeInvoke<WidgetInstance[]>('get_widgets');
  }
  return getStorage<WidgetInstance[]>('deskit_widgets', []);
}

export async function pinWidget(widgetType: string, title?: string): Promise<WidgetInstance> {
  if (isTauri()) {
    return await safeInvoke<WidgetInstance>('pin_widget', {
      widgetType,
      widget_type: widgetType,
      title,
    });
  }

  // Browser Fallback: Persist in localStorage and open an independent popup window
  const widgets = getStorage<WidgetInstance[]>('deskit_widgets', []);
  const existing = widgets.find((w) => w.widget_type === widgetType && w.is_pinned);

  const getDefaultDims = (type: string): [number, number] => {
    switch (type) {
      case 'clock':
        return [260, 140];
      case 'tasks':
        return [320, 420];
      case 'focus':
        return [280, 220];
      case 'notes':
        return [320, 360];
      case 'deadlines':
        return [320, 380];
      case 'goals':
        return [320, 380];
      default:
        return [280, 200];
    }
  };

  const [width, height] = getDefaultDims(widgetType);
  const now = new Date().toISOString();

  let instance: WidgetInstance;
  if (existing) {
    instance = existing;
  } else {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'w-' + Date.now();
    instance = {
      id,
      widget_type: widgetType as WidgetType,
      title: title || widgetType.charAt(0).toUpperCase() + widgetType.slice(1),
      x: 100 + (widgets.length % 6) * 30,
      y: 100 + (widgets.length % 6) * 30,
      width,
      height,
      is_pinned: true,
      visibility_mode: 'always_on_top',
      is_collapsed: false,
      config_json: '{}',
      created_at: now,
      updated_at: now,
    };
    widgets.push(instance);
    setStorage('deskit_widgets', widgets);
  }

  // Open independent popup window in browser
  try {
    const popupUrl = `/?widget_id=${encodeURIComponent(instance.id)}&type=${encodeURIComponent(instance.widget_type)}&t=${Date.now()}`;
    sessionStorage.setItem('last_deskit_widget', JSON.stringify(instance));
    const windowName = `widget_${instance.widget_type}_${instance.id.replace(/-/g, '_')}`;
    const features = `width=${width},height=${height},left=${instance.x},top=${instance.y},menubar=no,status=no,toolbar=no,location=no,resizable=yes`;
    window.open(popupUrl, windowName, features);
  } catch (err) {
    console.warn('[pinWidget] Browser popup blocked or unavailable:', err);
  }

  emitLocalEvent('widget-updated', instance);
  return instance;
}

export async function unpinWidget(widgetId: string): Promise<void> {
  if (isTauri()) {
    await safeInvoke('unpin_widget', { widgetId, widget_id: widgetId });
  } else {
    const widgets = getStorage<WidgetInstance[]>('deskit_widgets', []);
    const updated = widgets.map((w) => (w.id === widgetId ? { ...w, is_pinned: false } : w));
    setStorage('deskit_widgets', updated);
    emitLocalEvent('widget-updated', widgetId);
  }
}

export async function removeWidget(widgetId: string): Promise<void> {
  if (isTauri()) {
    await safeInvoke('remove_widget', { widgetId, widget_id: widgetId });
  } else {
    const widgets = getStorage<WidgetInstance[]>('deskit_widgets', []);
    const updated = widgets.filter((w) => w.id !== widgetId);
    setStorage('deskit_widgets', updated);
    emitLocalEvent('widget-removed', widgetId);
  }
}

export async function setWidgetVisibility(widgetId: string, visibilityMode: VisibilityMode): Promise<void> {
  if (isTauri()) {
    await safeInvoke('set_widget_visibility', {
      widgetId,
      widget_id: widgetId,
      visibilityMode,
      visibility_mode: visibilityMode,
    });
  } else {
    const widgets = getStorage<WidgetInstance[]>('deskit_widgets', []);
    const updated = widgets.map((w) => (w.id === widgetId ? { ...w, visibility_mode: visibilityMode } : w));
    setStorage('deskit_widgets', updated);
    emitLocalEvent('widget-updated', widgetId);
  }
}

export async function toggleCollapseWidget(widgetId: string, isCollapsed: boolean): Promise<void> {
  if (isTauri()) {
    await safeInvoke('toggle_collapse_widget', {
      widgetId,
      widget_id: widgetId,
      isCollapsed,
      is_collapsed: isCollapsed,
    });
  } else {
    const widgets = getStorage<WidgetInstance[]>('deskit_widgets', []);
    const updated = widgets.map((w) => (w.id === widgetId ? { ...w, is_collapsed: isCollapsed } : w));
    setStorage('deskit_widgets', updated);
    emitLocalEvent('widget-updated', widgetId);
  }
}

// ---------------- TASKS ----------------
export async function getTasks(): Promise<Task[]> {
  if (isTauri()) {
    return await safeInvoke<Task[]>('get_tasks');
  }
  return getStorage<Task[]>('deskit_tasks', []);
}

export async function saveTask(task: Partial<Task> & { title: string }): Promise<Task> {
  if (isTauri()) {
    return await safeInvoke<Task>('save_task', { task });
  }
  const tasks = getStorage<Task[]>('deskit_tasks', []);
  const now = new Date().toISOString();
  let saved: Task;
  if (task.id) {
    saved = { ...(tasks.find((t) => t.id === task.id) || ({} as Task)), ...task, updated_at: now } as Task;
    const idx = tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) tasks[idx] = saved;
    else tasks.push(saved);
  } else {
    saved = {
      id: 't-' + Date.now(),
      title: task.title,
      description: task.description || undefined,
      is_completed: task.is_completed ?? false,
      priority: task.priority || 'medium',
      due_date: task.due_date || undefined,
      created_at: now,
      updated_at: now,
    };
    tasks.push(saved);
  }
  setStorage('deskit_tasks', tasks);
  emitLocalEvent('tasks-updated', saved);
  return saved;
}

export async function deleteTask(id: string): Promise<void> {
  if (isTauri()) {
    await safeInvoke('delete_task', { id });
  } else {
    const tasks = getStorage<Task[]>('deskit_tasks', []);
    const filtered = tasks.filter((t) => t.id !== id);
    setStorage('deskit_tasks', filtered);
    emitLocalEvent('tasks-updated', id);
  }
}

// ---------------- NOTES ----------------
export async function getNotes(): Promise<Note[]> {
  if (isTauri()) {
    return await safeInvoke<Note[]>('get_notes');
  }
  return getStorage<Note[]>('deskit_notes', []);
}

export async function saveNote(note: Partial<Note> & { title: string; content: string }): Promise<Note> {
  if (isTauri()) {
    return await safeInvoke<Note>('save_note', { note });
  }
  const notes = getStorage<Note[]>('deskit_notes', []);
  const now = new Date().toISOString();
  let saved: Note;
  if (note.id) {
    saved = { ...(notes.find((n) => n.id === note.id) || ({} as Note)), ...note, updated_at: now } as Note;
    const idx = notes.findIndex((n) => n.id === note.id);
    if (idx >= 0) notes[idx] = saved;
    else notes.push(saved);
  } else {
    saved = {
      id: 'n-' + Date.now(),
      title: note.title,
      content: note.content,
      created_at: now,
      updated_at: now,
    };
    notes.push(saved);
  }
  setStorage('deskit_notes', notes);
  emitLocalEvent('notes-updated', saved);
  return saved;
}

export async function deleteNote(id: string): Promise<void> {
  if (isTauri()) {
    await safeInvoke('delete_note', { id });
  } else {
    const notes = getStorage<Note[]>('deskit_notes', []);
    const filtered = notes.filter((n) => n.id !== id);
    setStorage('deskit_notes', filtered);
    emitLocalEvent('notes-updated', id);
  }
}

// ---------------- FOCUS ----------------
export async function getFocusSession(): Promise<FocusSession> {
  if (isTauri()) {
    return await safeInvoke<FocusSession>('get_focus_session');
  }
  return getStorage<FocusSession>('deskit_focus', DEFAULT_FOCUS);
}

export async function saveFocusSession(session: FocusSession): Promise<FocusSession> {
  if (isTauri()) {
    return await safeInvoke<FocusSession>('save_focus_session', { session });
  }
  const updated = { ...session, updated_at: new Date().toISOString() };
  setStorage('deskit_focus', updated);
  emitLocalEvent('focus-updated', updated);
  return updated;
}

// ---------------- DEADLINES ----------------
export async function getDeadlines(): Promise<Deadline[]> {
  if (isTauri()) {
    return await safeInvoke<Deadline[]>('get_deadlines');
  }
  return getStorage<Deadline[]>('deskit_deadlines', []);
}

export async function saveDeadline(deadline: Partial<Deadline> & { title: string; due_date: string }): Promise<Deadline> {
  if (isTauri()) {
    return await safeInvoke<Deadline>('save_deadline', { deadline });
  }
  const deadlines = getStorage<Deadline[]>('deskit_deadlines', []);
  const now = new Date().toISOString();
  let saved: Deadline;
  if (deadline.id) {
    saved = { ...(deadlines.find((d) => d.id === deadline.id) || ({} as Deadline)), ...deadline, updated_at: now } as Deadline;
    const idx = deadlines.findIndex((d) => d.id === deadline.id);
    if (idx >= 0) deadlines[idx] = saved;
    else deadlines.push(saved);
  } else {
    saved = {
      id: 'd-' + Date.now(),
      title: deadline.title,
      due_date: deadline.due_date,
      category: deadline.category || 'General',
      is_completed: deadline.is_completed ?? false,
      created_at: now,
      updated_at: now,
    };
    deadlines.push(saved);
  }
  setStorage('deskit_deadlines', deadlines);
  emitLocalEvent('deadlines-updated', saved);
  return saved;
}

export async function deleteDeadline(id: string): Promise<void> {
  if (isTauri()) {
    await safeInvoke('delete_deadline', { id });
  } else {
    const deadlines = getStorage<Deadline[]>('deskit_deadlines', []);
    const filtered = deadlines.filter((d) => d.id !== id);
    setStorage('deskit_deadlines', filtered);
    emitLocalEvent('deadlines-updated', id);
  }
}

// ---------------- GOALS ----------------
export async function getGoals(): Promise<DailyGoal[]> {
  if (isTauri()) {
    return await safeInvoke<DailyGoal[]>('get_goals');
  }
  return getStorage<DailyGoal[]>('deskit_goals', []);
}

export async function saveGoal(goal: Partial<DailyGoal> & { title: string }): Promise<DailyGoal> {
  if (isTauri()) {
    return await safeInvoke<DailyGoal>('save_goal', { goal });
  }
  const goals = getStorage<DailyGoal[]>('deskit_goals', []);
  const now = new Date().toISOString();
  let saved: DailyGoal;
  if (goal.id) {
    saved = { ...(goals.find((g) => g.id === goal.id) || ({} as DailyGoal)), ...goal, updated_at: now } as DailyGoal;
    const idx = goals.findIndex((g) => g.id === goal.id);
    if (idx >= 0) goals[idx] = saved;
    else goals.push(saved);
  } else {
    saved = {
      id: 'g-' + Date.now(),
      title: goal.title,
      target_count: goal.target_count || 1,
      current_count: goal.current_count || 0,
      is_completed: goal.is_completed ?? false,
      date_str: goal.date_str || now.split('T')[0],
      created_at: now,
      updated_at: now,
    };
    goals.push(saved);
  }
  setStorage('deskit_goals', goals);
  emitLocalEvent('goals-updated', saved);
  return saved;
}

export async function deleteGoal(id: string): Promise<void> {
  if (isTauri()) {
    await safeInvoke('delete_goal', { id });
  } else {
    const goals = getStorage<DailyGoal[]>('deskit_goals', []);
    const filtered = goals.filter((g) => g.id !== id);
    setStorage('deskit_goals', filtered);
    emitLocalEvent('goals-updated', id);
  }
}

// ---------------- SETTINGS ----------------
export async function getSettings(): Promise<AppSettings> {
  if (isTauri()) {
    return await safeInvoke<AppSettings>('get_settings');
  }
  return getStorage<AppSettings>('deskit_settings', DEFAULT_SETTINGS);
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  if (isTauri()) {
    return await safeInvoke<AppSettings>('save_settings', { settings });
  }
  const updated = { ...settings, updated_at: new Date().toISOString() };
  setStorage('deskit_settings', updated);
  emitLocalEvent('settings-updated', updated);
  return updated;
}
