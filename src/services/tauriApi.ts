import { WidgetInstance, VisibilityMode, WidgetType } from '@/types/widget';
import { Task } from '@/types/task';
import { Note } from '@/types/note';
import { FocusSession } from '@/types/focus';
import { Deadline } from '@/types/deadline';
import { DailyGoal, GoalHistoryEntry } from '@/types/goal';
import { AppSettings } from '@/types/settings';
import { Workspace } from '@/types/workspace';
import { WorldClock, Alarm } from '@/types/clock';
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
  show_seconds: true,
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

export async function clearWindowAcrylic(): Promise<void> {
  if (isTauri()) {
    await safeInvoke('clear_window_acrylic');
  }
}

export async function applyWindowAcrylic(): Promise<void> {
  if (isTauri()) {
    await safeInvoke('apply_window_acrylic');
  }
}

export async function updateWindowClipRegion(isCollapsed: boolean, radius = 28): Promise<void> {
  if (isTauri()) {
    await safeInvoke('update_window_clip_region', { is_collapsed: isCollapsed, radius });
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

export async function setWindowPosition(x: number, y: number): Promise<void> {
  if (isTauri()) {
    await safeInvoke('set_window_position', { x, y });
  } else {
    try {
      window.moveTo(x, y);
    } catch {}
  }
}

export async function getWindowPosition(): Promise<[number, number]> {
  if (isTauri()) {
    return await safeInvoke<[number, number]>('get_window_position');
  }
  return [window.screenX, window.screenY];
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
  const now = new Date().toISOString();
  const fullTask: Task = {
    id: task.id || ('t-' + Date.now()),
    title: task.title,
    description: task.description || undefined,
    is_completed: task.is_completed ?? false,
    priority: task.priority || 'medium',
    due_date: task.due_date || undefined,
    created_at: task.created_at || now,
    updated_at: now,
  };
  if (isTauri()) {
    return await safeInvoke<Task>('save_task', { task: fullTask });
  }
  const tasks = getStorage<Task[]>('deskit_tasks', []);
  let saved: Task;
  if (task.id) {
    saved = { ...(tasks.find((t) => t.id === task.id) || ({} as Task)), ...task, updated_at: now } as Task;
    const idx = tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) tasks[idx] = saved;
    else tasks.push(saved);
  } else {
    saved = fullTask;
    tasks.push(saved);
  }
  setStorage('deskit_tasks', tasks);
  emitLocalEvent('tasks-updated', saved);
  return saved;
}

export async function toggleTask(id: string): Promise<Task> {
  if (isTauri()) {
    return await safeInvoke<Task>('toggle_task', { id });
  }
  const tasks = getStorage<Task[]>('deskit_tasks', []);
  const task = tasks.find((t) => t.id === id);
  if (!task) throw new Error('Task not found');
  const updated: Task = {
    ...task,
    is_completed: !task.is_completed,
    updated_at: new Date().toISOString(),
  };
  const idx = tasks.findIndex((t) => t.id === id);
  tasks[idx] = updated;
  setStorage('deskit_tasks', tasks);
  emitLocalEvent('tasks-updated', updated);
  return updated;
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
  const now = new Date().toISOString();
  const fullNote: Note = {
    id: note.id || ('n-' + Date.now()),
    title: note.title || 'Untitled Note',
    content: note.content || '',
    is_pinned: note.is_pinned ?? false,
    created_at: note.created_at || now,
    updated_at: now,
  };
  if (isTauri()) {
    return await safeInvoke<Note>('save_note', { note: fullNote });
  }
  const notes = getStorage<Note[]>('deskit_notes', []);
  let saved: Note;
  if (note.id) {
    saved = { ...(notes.find((n) => n.id === note.id) || ({} as Note)), ...note, updated_at: now } as Note;
    const idx = notes.findIndex((n) => n.id === note.id);
    if (idx >= 0) notes[idx] = saved;
    else notes.push(saved);
  } else {
    saved = fullNote;
    notes.push(saved);
  }
  setStorage('deskit_notes', notes);
  emitLocalEvent('notes-updated', saved);
  return saved;
}

export async function togglePinNote(id: string): Promise<Note> {
  if (isTauri()) {
    return await safeInvoke<Note>('toggle_pin_note', { id });
  }
  const notes = getStorage<Note[]>('deskit_notes', []);
  const note = notes.find((n) => n.id === id);
  if (!note) throw new Error('Note not found');
  const updated: Note = {
    ...note,
    is_pinned: !note.is_pinned,
    updated_at: new Date().toISOString(),
  };
  const idx = notes.findIndex((n) => n.id === id);
  notes[idx] = updated;
  setStorage('deskit_notes', notes);
  emitLocalEvent('notes-updated', updated);
  return updated;
}

export async function searchNotes(query: string): Promise<Note[]> {
  if (isTauri()) {
    return await safeInvoke<Note[]>('search_notes', { query });
  }
  const notes = getStorage<Note[]>('deskit_notes', []);
  const q = query.toLowerCase();
  return notes
    .filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
    .sort((a, b) => {
      if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) {
        return a.is_pinned ? -1 : 1;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
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
  const s = getStorage<FocusSession>('deskit_focus', DEFAULT_FOCUS);
  if (s.is_running && s.ends_at) {
    const rem = Math.max(0, Math.ceil((new Date(s.ends_at).getTime() - Date.now()) / 1000));
    if (rem <= 0) {
      const next: FocusSession = {
        ...s,
        is_running: false,
        ends_at: null,
        state: s.state === 'focus' ? 'break' : 'idle',
        remaining_seconds: (s.state === 'focus' ? s.break_minutes : s.duration_minutes) * 60,
        updated_at: new Date().toISOString(),
      };
      setStorage('deskit_focus', next);
      emitLocalEvent('focus-completed', s.state);
      emitLocalEvent('focus-updated', next);
      return next;
    }
    s.remaining_seconds = rem;
  }
  return s;
}

export async function startFocusTimer(): Promise<FocusSession> {
  if (isTauri()) {
    return await safeInvoke<FocusSession>('start_focus_timer');
  }
  const s = await getFocusSession();
  const targetState = s.state === 'idle' || s.state === 'paused' ? 'focus' : s.state;
  const rem = s.remaining_seconds > 0 ? s.remaining_seconds : s.duration_minutes * 60;
  const endsAt = new Date(Date.now() + rem * 1000).toISOString();
  const updated: FocusSession = {
    ...s,
    state: targetState,
    is_running: true,
    remaining_seconds: rem,
    ends_at: endsAt,
    updated_at: new Date().toISOString(),
  };
  setStorage('deskit_focus', updated);
  emitLocalEvent('focus-updated', updated);
  return updated;
}

export async function pauseFocusTimer(): Promise<FocusSession> {
  if (isTauri()) {
    return await safeInvoke<FocusSession>('pause_focus_timer');
  }
  const s = await getFocusSession();
  const updated: FocusSession = {
    ...s,
    state: 'paused',
    is_running: false,
    ends_at: null,
    updated_at: new Date().toISOString(),
  };
  setStorage('deskit_focus', updated);
  emitLocalEvent('focus-updated', updated);
  return updated;
}

export async function resetFocusTimer(): Promise<FocusSession> {
  if (isTauri()) {
    return await safeInvoke<FocusSession>('reset_focus_timer');
  }
  const s = await getFocusSession();
  const updated: FocusSession = {
    ...s,
    state: 'idle',
    is_running: false,
    remaining_seconds: s.duration_minutes * 60,
    ends_at: null,
    updated_at: new Date().toISOString(),
  };
  setStorage('deskit_focus', updated);
  emitLocalEvent('focus-updated', updated);
  return updated;
}

export async function addFocusMinutes(minutes: number): Promise<FocusSession> {
  if (isTauri()) {
    return await safeInvoke<FocusSession>('add_focus_minutes', { minutes });
  }
  const s = await getFocusSession();
  const addSecs = minutes * 60;
  let updated: FocusSession;
  if (s.is_running && s.ends_at) {
    const newEnds = new Date(new Date(s.ends_at).getTime() + addSecs * 1000).toISOString();
    updated = {
      ...s,
      ends_at: newEnds,
      remaining_seconds: Math.max(0, Math.ceil((new Date(newEnds).getTime() - Date.now()) / 1000)),
      updated_at: new Date().toISOString(),
    };
  } else {
    updated = {
      ...s,
      remaining_seconds: s.remaining_seconds + addSecs,
      ends_at: null,
      updated_at: new Date().toISOString(),
    };
  }
  setStorage('deskit_focus', updated);
  emitLocalEvent('focus-updated', updated);
  return updated;
}

export async function switchFocusMode(mode: 'focus' | 'break'): Promise<FocusSession> {
  if (isTauri()) {
    return await safeInvoke<FocusSession>('switch_focus_mode', { mode });
  }
  const s = await getFocusSession();
  const dur = mode === 'focus' ? s.duration_minutes : s.break_minutes;
  const updated: FocusSession = {
    ...s,
    state: mode,
    is_running: false,
    remaining_seconds: dur * 60,
    ends_at: null,
    updated_at: new Date().toISOString(),
  };
  setStorage('deskit_focus', updated);
  emitLocalEvent('focus-updated', updated);
  return updated;
}

export async function setFocusDurations(focusMins: number, breakMins: number): Promise<FocusSession> {
  if (isTauri()) {
    return await safeInvoke<FocusSession>('set_focus_durations', {
      focusMins,
      focus_mins: focusMins,
      breakMins,
      break_mins: breakMins,
    });
  }
  const s = await getFocusSession();
  const f = Math.max(1, Math.min(240, focusMins));
  const b = Math.max(1, Math.min(60, breakMins));
  const updated: FocusSession = {
    ...s,
    duration_minutes: f,
    break_minutes: b,
    remaining_seconds: f * 60,
    state: 'idle',
    is_running: false,
    ends_at: null,
    updated_at: new Date().toISOString(),
  };
  setStorage('deskit_focus', updated);
  emitLocalEvent('focus-updated', updated);
  return updated;
}

export async function tickFocusTimer(): Promise<FocusSession> {
  if (isTauri()) {
    return await safeInvoke<FocusSession>('tick_focus_timer');
  }
  return await getFocusSession();
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
  const now = new Date().toISOString();
  const fullDeadline: Deadline = {
    id: deadline.id || ('d-' + Date.now()),
    title: deadline.title,
    due_date: deadline.due_date,
    category: deadline.category || 'General',
    is_completed: deadline.is_completed ?? false,
    notify_lead_minutes: deadline.notify_lead_minutes ?? 15,
    notified_lead: deadline.notified_lead ?? false,
    notified_due: deadline.notified_due ?? false,
    created_at: deadline.created_at || now,
    updated_at: now,
  };
  if (isTauri()) {
    return await safeInvoke<Deadline>('save_deadline', { deadline: fullDeadline });
  }
  const deadlines = getStorage<Deadline[]>('deskit_deadlines', []);
  let saved: Deadline;
  if (deadline.id) {
    saved = { ...(deadlines.find((d) => d.id === deadline.id) || ({} as Deadline)), ...deadline, updated_at: now } as Deadline;
    const idx = deadlines.findIndex((d) => d.id === deadline.id);
    if (idx >= 0) deadlines[idx] = saved;
    else deadlines.push(saved);
  } else {
    saved = fullDeadline;
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
  const now = new Date().toISOString();
  const fullGoal: DailyGoal = {
    id: goal.id || ('g-' + Date.now()),
    title: goal.title,
    target_count: goal.target_count || 1,
    current_count: goal.current_count || 0,
    is_completed: goal.is_completed ?? false,
    date_str: goal.date_str || now.split('T')[0],
    created_at: goal.created_at || now,
    updated_at: now,
  };
  if (isTauri()) {
    return await safeInvoke<DailyGoal>('save_goal', { goal: fullGoal });
  }
  const goals = getStorage<DailyGoal[]>('deskit_goals', []);
  let saved: DailyGoal;
  if (goal.id) {
    saved = { ...(goals.find((g) => g.id === goal.id) || ({} as DailyGoal)), ...goal, updated_at: now } as DailyGoal;
    const idx = goals.findIndex((g) => g.id === goal.id);
    if (idx >= 0) goals[idx] = saved;
    else goals.push(saved);
  } else {
    saved = fullGoal;
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

export async function incrementGoal(id: string): Promise<DailyGoal> {
  if (isTauri()) {
    return await safeInvoke<DailyGoal>('increment_goal', { id });
  }
  const goals = getStorage<DailyGoal[]>('deskit_goals', []);
  const goal = goals.find((g) => g.id === id);
  if (!goal) throw new Error('Goal not found');
  const nextCount = goal.current_count + 1;
  const isCompleted = nextCount >= goal.target_count;
  const updated: DailyGoal = {
    ...goal,
    current_count: nextCount,
    is_completed: isCompleted,
    updated_at: new Date().toISOString(),
  };
  const idx = goals.findIndex((g) => g.id === id);
  goals[idx] = updated;
  setStorage('deskit_goals', goals);
  emitLocalEvent('goals-updated', updated);
  return updated;
}

export async function decrementGoal(id: string): Promise<DailyGoal> {
  if (isTauri()) {
    return await safeInvoke<DailyGoal>('decrement_goal', { id });
  }
  const goals = getStorage<DailyGoal[]>('deskit_goals', []);
  const goal = goals.find((g) => g.id === id);
  if (!goal) throw new Error('Goal not found');
  const nextCount = Math.max(0, goal.current_count - 1);
  const isCompleted = nextCount >= goal.target_count;
  const updated: DailyGoal = {
    ...goal,
    current_count: nextCount,
    is_completed: isCompleted,
    updated_at: new Date().toISOString(),
  };
  const idx = goals.findIndex((g) => g.id === id);
  goals[idx] = updated;
  setStorage('deskit_goals', goals);
  emitLocalEvent('goals-updated', updated);
  return updated;
}

export async function toggleGoal(id: string): Promise<DailyGoal> {
  if (isTauri()) {
    return await safeInvoke<DailyGoal>('toggle_goal', { id });
  }
  const goals = getStorage<DailyGoal[]>('deskit_goals', []);
  const goal = goals.find((g) => g.id === id);
  if (!goal) throw new Error('Goal not found');
  const isCompleted = !goal.is_completed;
  const updated: DailyGoal = {
    ...goal,
    is_completed: isCompleted,
    current_count: isCompleted ? Math.max(goal.current_count, goal.target_count) : 0,
    updated_at: new Date().toISOString(),
  };
  const idx = goals.findIndex((g) => g.id === id);
  goals[idx] = updated;
  setStorage('deskit_goals', goals);
  emitLocalEvent('goals-updated', updated);
  return updated;
}

export async function getGoalHistory(goalId: string): Promise<GoalHistoryEntry[]> {
  if (isTauri()) {
    return await safeInvoke<GoalHistoryEntry[]>('get_goal_history', {
      goalId,
      goal_id: goalId,
    });
  }
  return [];
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

// ---------------- WORKSPACES ----------------
const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: 'default',
    name: 'Default Desktop',
    description: 'Standard desktop productivity setup',
    is_active: true,
    widgets: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'study',
    name: 'Study & Deep Work',
    description: 'Focus timer, tasks, clock, and daily habit goals for uninterrupted study sessions.',
    is_active: false,
    widgets: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'developer',
    name: 'Developer Workspace',
    description: 'Milestone deadlines, scratchpad for snippets, task tracker, and clock.',
    is_active: false,
    widgets: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'minimal',
    name: 'Zen Minimalist',
    description: 'Zero clutter. Only the clock and a circular focus timer on your desktop.',
    is_active: false,
    widgets: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export async function getWorkspaces(): Promise<Workspace[]> {
  if (isTauri()) {
    return await safeInvoke<Workspace[]>('get_workspaces');
  }
  return getStorage<Workspace[]>('deskit_workspaces', DEFAULT_WORKSPACES);
}

export async function getActiveWorkspace(): Promise<Workspace | null> {
  if (isTauri()) {
    return await safeInvoke<Workspace | null>('get_active_workspace');
  }
  const list = getStorage<Workspace[]>('deskit_workspaces', DEFAULT_WORKSPACES);
  return list.find((w) => w.is_active) || list[0] || null;
}

export async function switchWorkspace(workspaceId: string): Promise<Workspace> {
  if (isTauri()) {
    return await safeInvoke<Workspace>('switch_workspace', {
      workspaceId,
      workspace_id: workspaceId,
    });
  }
  const list = getStorage<Workspace[]>('deskit_workspaces', DEFAULT_WORKSPACES);
  const updated = list.map((w) => ({
    ...w,
    is_active: w.id === workspaceId,
    updated_at: new Date().toISOString(),
  }));
  setStorage('deskit_workspaces', updated);
  const active = updated.find((w) => w.id === workspaceId) || updated[0];
  emitLocalEvent('workspace-switched', active);
  return active;
}

export async function saveWorkspace(workspace: Workspace): Promise<Workspace> {
  if (isTauri()) {
    return await safeInvoke<Workspace>('save_workspace', { workspace });
  }
  const list = getStorage<Workspace[]>('deskit_workspaces', DEFAULT_WORKSPACES);
  const idx = list.findIndex((w) => w.id === workspace.id);
  const updated = { ...workspace, updated_at: new Date().toISOString() };
  if (idx >= 0) {
    list[idx] = updated;
  } else {
    list.push(updated);
  }
  setStorage('deskit_workspaces', list);
  emitLocalEvent('workspace-updated', updated);
  return updated;
}

export async function saveCurrentWorkspace(
  id?: string,
  name?: string,
  description?: string
): Promise<Workspace> {
  if (isTauri()) {
    return await safeInvoke<Workspace>('save_current_workspace', {
      id: id || null,
      name: name || 'Custom Layout',
      description: description || null,
    });
  }
  const list = getStorage<Workspace[]>('deskit_workspaces', DEFAULT_WORKSPACES);
  const created: Workspace = {
    id: id || Date.now().toString(),
    name: name || 'Custom Layout',
    description: description || '',
    is_active: true,
    widgets: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const updated = list.map((w) => ({ ...w, is_active: false }));
  updated.unshift(created);
  setStorage('deskit_workspaces', updated);
  emitLocalEvent('workspace-updated', created);
  return created;
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  if (isTauri()) {
    await safeInvoke<void>('delete_workspace', {
      workspaceId,
      workspace_id: workspaceId,
    });
    return;
  }
  const list = getStorage<Workspace[]>('deskit_workspaces', DEFAULT_WORKSPACES);
  const updated = list.filter((w) => w.id !== workspaceId);
  setStorage('deskit_workspaces', updated);
  emitLocalEvent('workspace-deleted', workspaceId);
}

// ---------------- WORLD CLOCK ----------------
const DEFAULT_WORLD_CLOCKS: WorldClock[] = [
  { id: 'wc-nyc', city_name: 'New York', timezone: 'America/New_York', sort_order: 1 },
  { id: 'wc-lon', city_name: 'London', timezone: 'Europe/London', sort_order: 2 },
  { id: 'wc-tyo', city_name: 'Tokyo', timezone: 'Asia/Tokyo', sort_order: 3 },
];

export async function getWorldClocks(): Promise<WorldClock[]> {
  if (isTauri()) {
    return await safeInvoke<WorldClock[]>('get_world_clocks');
  }
  return getStorage<WorldClock[]>('deskit_world_clocks', DEFAULT_WORLD_CLOCKS);
}

export async function saveWorldClock(clock: WorldClock): Promise<WorldClock> {
  if (isTauri()) {
    return await safeInvoke<WorldClock>('save_world_clock', { clock });
  }
  const list = getStorage<WorldClock[]>('deskit_world_clocks', DEFAULT_WORLD_CLOCKS);
  const idx = list.findIndex((c) => c.id === clock.id);
  const updated: WorldClock = {
    ...clock,
    id: clock.id || Date.now().toString(),
    updated_at: new Date().toISOString(),
  };
  if (idx >= 0) {
    list[idx] = updated;
  } else {
    list.push(updated);
  }
  setStorage('deskit_world_clocks', list);
  emitLocalEvent('world-clocks-updated', updated);
  return updated;
}

export async function deleteWorldClock(id: string): Promise<void> {
  if (isTauri()) {
    await safeInvoke<void>('delete_world_clock', { id });
    return;
  }
  const list = getStorage<WorldClock[]>('deskit_world_clocks', DEFAULT_WORLD_CLOCKS);
  const updated = list.filter((c) => c.id !== id);
  setStorage('deskit_world_clocks', updated);
  emitLocalEvent('world-clock-deleted', id);
}

// ---------------- ALARMS ----------------
const DEFAULT_ALARMS: Alarm[] = [
  {
    id: 'alarm-default',
    title: 'Morning Standup',
    time_str: '09:00',
    days_of_week: [1, 2, 3, 4, 5],
    is_enabled: true,
    is_recurring: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export async function getAlarms(): Promise<Alarm[]> {
  if (isTauri()) {
    return await safeInvoke<Alarm[]>('get_alarms');
  }
  return getStorage<Alarm[]>('deskit_alarms', DEFAULT_ALARMS);
}

export async function saveAlarm(alarm: Alarm): Promise<Alarm> {
  if (isTauri()) {
    return await safeInvoke<Alarm>('save_alarm', { alarm });
  }
  const list = getStorage<Alarm[]>('deskit_alarms', DEFAULT_ALARMS);
  const idx = list.findIndex((a) => a.id === alarm.id);
  const updated: Alarm = {
    ...alarm,
    id: alarm.id || Date.now().toString(),
    updated_at: new Date().toISOString(),
  };
  if (idx >= 0) {
    list[idx] = updated;
  } else {
    list.push(updated);
  }
  setStorage('deskit_alarms', list);
  emitLocalEvent('alarms-updated', updated);
  return updated;
}

export async function toggleAlarm(id: string): Promise<Alarm> {
  if (isTauri()) {
    return await safeInvoke<Alarm>('toggle_alarm', { id });
  }
  const list = getStorage<Alarm[]>('deskit_alarms', DEFAULT_ALARMS);
  const idx = list.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error('Alarm not found');
  const updated: Alarm = {
    ...list[idx],
    is_enabled: !list[idx].is_enabled,
    updated_at: new Date().toISOString(),
  };
  list[idx] = updated;
  setStorage('deskit_alarms', list);
  emitLocalEvent('alarms-updated', updated);
  return updated;
}

export async function deleteAlarm(id: string): Promise<void> {
  if (isTauri()) {
    await safeInvoke<void>('delete_alarm', { id });
    return;
  }
  const list = getStorage<Alarm[]>('deskit_alarms', DEFAULT_ALARMS);
  const updated = list.filter((a) => a.id !== id);
  setStorage('deskit_alarms', updated);
  emitLocalEvent('alarms-updated', id);
}

export async function dismissAlarm(id?: string): Promise<void> {
  if (isTauri()) {
    await safeInvoke<void>('dismiss_alarm', { id: id || null });
    return;
  }
  emitLocalEvent('alarm-dismissed', id || null);
}

export async function getActiveRingingAlarm(): Promise<string | null> {
  if (isTauri()) {
    return await safeInvoke<string | null>('get_active_ringing_alarm');
  }
  return null;
}
