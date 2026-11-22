import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskStore } from '@/stores/taskStore';
import { Task, TaskPriority } from '@/types/task';
import {
  PlusIcon,
  TrashIcon,
  CheckIcon,
  EditIcon,
  CalendarIcon,
} from '@/components/shared/icons';
import { useWidgetDimensions } from '@/hooks/useWidgetDimensions';
import { useAppearanceStore } from '@/stores/appearanceStore';
import GlassWidget from '@/components/widgets/GlassWidget';

export interface TaskDueStatus {
  status: 'overdue' | 'today' | 'upcoming';
  label: string;
  isOverdue: boolean;
  isToday: boolean;
}

export function getTaskDueStatus(dueDateStr?: string | null): TaskDueStatus | null {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  if (isNaN(due.getTime())) return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const hasTime = dueDateStr.includes('T') || dueDateStr.includes(' ');
  const timeStr = hasTime
    ? due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';

  const isOverdue = hasTime
    ? due.getTime() < now.getTime()
    : dueStart.getTime() < todayStart.getTime();

  if (isOverdue) {
    if (dueStart.getTime() === todayStart.getTime()) {
      return {
        status: 'overdue',
        label: hasTime ? `Overdue (${timeStr})` : 'Overdue today',
        isOverdue: true,
        isToday: true,
      };
    }
    const daysAgo = Math.max(
      1,
      Math.floor((todayStart.getTime() - dueStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    return {
      status: 'overdue',
      label: daysAgo === 1 ? 'Overdue (Yesterday)' : `Overdue (${daysAgo}d ago)`,
      isOverdue: true,
      isToday: false,
    };
  }

  if (dueStart.getTime() === todayStart.getTime()) {
    return {
      status: 'today',
      label: hasTime ? `Today at ${timeStr}` : 'Today',
      isOverdue: false,
      isToday: true,
    };
  }

  if (dueStart.getTime() === tomorrowStart.getTime()) {
    return {
      status: 'upcoming',
      label: hasTime ? `Tomorrow at ${timeStr}` : 'Tomorrow',
      isOverdue: false,
      isToday: false,
    };
  }

  const isThisYear = due.getFullYear() === now.getFullYear();
  const dateFormatted = due.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    ...(isThisYear ? {} : { year: 'numeric' }),
  });

  return {
    status: 'upcoming',
    label: hasTime ? `${dateFormatted}, ${timeStr}` : dateFormatted,
    isOverdue: false,
    isToday: false,
  };
}

const getLocalQuickDateIso = (daysAhead: number, hour = 18): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const TasksWidgetContent: React.FC = () => {
  const {
    tasks,
    isLoading,
    fetchTasks,
    addTask,
    toggleComplete,
    updateTask,
    deleteTask,
    initListeners,
  } = useTaskStore();
  const { reducedMotion } = useAppearanceStore();
  const { isXs, isVeryShort, isNarrow } = useWidgetDimensions();

  // Creation form state
  const [newTitle, setNewTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [showAddDetails, setShowAddDetails] = useState(false);

  // Filter state
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Inline editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editDueDate, setEditDueDate] = useState('');

  useEffect(() => {
    fetchTasks();
    const cleanup = initListeners();
    return () => {
      cleanup.then((fn) => fn && fn());
    };
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addTask(
      newTitle.trim(),
      priority,
      newDueDate.trim() || undefined,
      newDescription.trim() || undefined
    );
    setNewTitle('');
    setNewDueDate('');
    setNewDescription('');
    setShowAddDetails(false);
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
    setEditDueDate(task.due_date || '');
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditTitle('');
    setEditDescription('');
    setEditDueDate('');
  };

  const handleSaveEdit = (task: Task) => {
    if (!editTitle.trim()) return;
    updateTask({
      ...task,
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
      priority: editPriority,
      due_date: editDueDate.trim() || undefined,
    });
    setEditingTaskId(null);
  };

  const handleClearCompleted = async () => {
    const completed = tasks.filter((t) => t.is_completed);
    for (const t of completed) {
      await deleteTask(t.id);
    }
  };

  const pendingCount = tasks.filter((t) => !t.is_completed).length;
  const completedCount = tasks.filter((t) => t.is_completed).length;

  // Sensible sorting:
  // 1. Incompleted tasks:
  //    - Due dates (chronological: overdue first, today next, upcoming next)
  //    - No due date (priority: high > medium > low, then created_at desc)
  // 2. Completed tasks: updated_at desc
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.is_completed !== b.is_completed) {
      return a.is_completed ? 1 : -1;
    }

    if (!a.is_completed) {
      const aDue = a.due_date ? new Date(a.due_date).getTime() : null;
      const bDue = b.due_date ? new Date(b.due_date).getTime() : null;

      if (aDue !== null && bDue !== null) {
        if (aDue !== bDue) return aDue - bDue;
      }
      if (aDue !== null && bDue === null) return -1;
      if (aDue === null && bDue !== null) return 1;

      const priorityWeight: Record<TaskPriority, number> = { high: 1, medium: 2, low: 3 };
      const pDiff = (priorityWeight[a.priority] || 2) - (priorityWeight[b.priority] || 2);
      if (pDiff !== 0) return pDiff;

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }

    const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bUpdated - aUpdated;
  });

  const filteredTasks = sortedTasks.filter((t) => {
    if (filter === 'active') return !t.is_completed;
    if (filter === 'completed') return t.is_completed;
    return true;
  });

  const transitionConfig = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, damping: 25, stiffness: 400 };

  // MICRO / XS VIEW: Display active next task + due status + count
  if (isXs || isVeryShort) {
    const nextTask = sortedTasks.find((t) => !t.is_completed);
    const dueStatus = nextTask ? getTaskDueStatus(nextTask.due_date) : null;

    return (
      <div className="flex flex-col justify-between h-full w-full select-none text-white p-0.5">
        <div className="flex items-center justify-between text-[10px] text-white/60 mb-1">
          <span className="font-semibold text-white">Next Task</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[9px] text-[#30D158] font-mono">
            {pendingCount} left
          </span>
        </div>

        {nextTask ? (
          <div
            onClick={() => toggleComplete(nextTask.id)}
            className="flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] cursor-pointer transition-all overflow-hidden"
          >
            <div className="w-3.5 h-3.5 rounded-full border border-white/40 hover:border-[#30D158] shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs text-white truncate font-medium">
                {nextTask.title}
              </span>
              {dueStatus && (
                <span
                  className={`text-[9px] font-mono truncate ${
                    dueStatus.status === 'overdue'
                      ? 'text-[#FF453A] font-semibold'
                      : dueStatus.status === 'today'
                      ? 'text-[#FF9F0A]'
                      : 'text-white/60'
                  }`}
                >
                  {dueStatus.label}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-[#30D158]">
            <CheckIcon size={12} className="mr-1" /> All tasks completed
          </div>
        )}
      </div>
    );
  }

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'high':
        return <span className="w-1.5 h-1.5 rounded-full bg-[#FF453A] shrink-0" title="High Priority" />;
      case 'low':
        return <span className="w-1.5 h-1.5 rounded-full bg-white/30 shrink-0" title="Low Priority" />;
      default:
        return <span className="w-1.5 h-1.5 rounded-full bg-[#FF9F0A] shrink-0" title="Medium Priority" />;
    }
  };

  return (
    <div className="flex flex-col h-full w-full select-none text-white overflow-hidden">
      {/* Header Info & Mac Filter Tabs */}
      <div className="flex items-center justify-between gap-1 mb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white">Tasks</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px] font-mono text-[#0A84FF]">
            {pendingCount}
          </span>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-black/40 border border-white/10 text-[10px]">
          {(['all', 'active', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-1.5 py-0.5 rounded capitalize transition-all ${
                filter === tab
                  ? 'bg-white/20 text-white font-medium shadow-sm'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Task Creation Form */}
      <form onSubmit={handleAdd} className="flex flex-col gap-1.5 mb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New task..."
            className="flex-1 min-w-0 px-2.5 py-1 text-xs bg-black/30 border border-white/10 rounded-lg outline-none focus:border-[#0A84FF]/60 text-white placeholder-white/40 transition-colors"
          />

          {/* Toggle details / due date button */}
          <button
            type="button"
            onClick={() => setShowAddDetails(!showAddDetails)}
            className={`p-1 rounded-lg transition-colors flex items-center justify-center shrink-0 ${
              showAddDetails || newDueDate
                ? 'bg-[#0A84FF]/20 text-[#0A84FF] border border-[#0A84FF]/40'
                : 'bg-black/30 text-white/50 hover:text-white border border-white/10'
            }`}
            title="Set due date & details"
          >
            <CalendarIcon size={13} />
          </button>

          {/* Priority Selector */}
          {!isNarrow && (
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="px-2 py-1 text-xs bg-black/40 border border-white/10 rounded-lg text-white/70 outline-none cursor-pointer"
            >
              <option value="low" className="bg-[#1C1C1E]">Low</option>
              <option value="medium" className="bg-[#1C1C1E]">Med</option>
              <option value="high" className="bg-[#1C1C1E]">High</option>
            </select>
          )}

          <button
            type="submit"
            className="p-1 rounded-lg btn-accent flex items-center justify-center shrink-0"
            title="Add task"
          >
            <PlusIcon size={14} />
          </button>
        </div>

        {/* Expandable Due Date & Optional Description */}
        <AnimatePresence>
          {(showAddDetails || newDueDate) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={transitionConfig}
              className="flex flex-col gap-1.5 p-2 rounded-xl bg-black/40 border border-white/10"
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <input
                  type="datetime-local"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="px-2 py-0.5 text-[11px] bg-white/10 border border-white/15 rounded-lg outline-none text-white cursor-pointer font-mono"
                />

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setNewDueDate(getLocalQuickDateIso(0))}
                    className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] text-white/80"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDueDate(getLocalQuickDateIso(1))}
                    className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] text-white/80"
                  >
                    Tomorrow
                  </button>
                  {newDueDate && (
                    <button
                      type="button"
                      onClick={() => setNewDueDate('')}
                      className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] text-white/50 hover:text-[#FF453A]"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description or notes (optional)..."
                className="px-2 py-1 text-[11px] bg-white/10 border border-white/15 rounded-lg outline-none text-white placeholder-white/40"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* Scrollable Task Items */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
        {isLoading && tasks.length === 0 ? (
          <div className="text-center text-xs text-white/40 py-4">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center text-xs text-white/40 py-6">
            No tasks in this view
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredTasks.map((task) => {
              const isEditing = editingTaskId === task.id;
              const dueStatus = getTaskDueStatus(task.due_date);

              if (isEditing) {
                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={transitionConfig}
                    className="flex flex-col gap-1.5 p-2 rounded-xl bg-black/60 border border-[#0A84FF]/50 shadow-lg"
                  >
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Task title..."
                        className="flex-1 min-w-0 px-2 py-1 text-xs bg-white/10 border border-white/20 rounded-lg outline-none text-white font-medium"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(task);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                      />

                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                        className="px-1.5 py-1 text-xs bg-black/50 border border-white/20 rounded-lg text-white outline-none cursor-pointer"
                      >
                        <option value="low" className="bg-[#1C1C1E]">Low</option>
                        <option value="medium" className="bg-[#1C1C1E]">Med</option>
                        <option value="high" className="bg-[#1C1C1E]">High</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <input
                        type="datetime-local"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="px-1.5 py-0.5 text-[10px] bg-white/10 border border-white/20 rounded-lg outline-none text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setEditDueDate(getLocalQuickDateIso(0))}
                        className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] text-white/80"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditDueDate(getLocalQuickDateIso(1))}
                        className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] text-white/80"
                      >
                        Tomorrow
                      </button>
                      {editDueDate && (
                        <button
                          type="button"
                          onClick={() => setEditDueDate('')}
                          className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] text-white/50 hover:text-[#FF453A]"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description (optional)..."
                      className="px-2 py-0.5 text-[11px] bg-white/10 border border-white/20 rounded-lg outline-none text-white placeholder-white/40"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(task);
                        if (e.key === 'Escape') cancelEditing();
                      }}
                    />

                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="px-2 py-0.5 text-[10px] rounded bg-white/10 hover:bg-white/20 text-white/70"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(task)}
                        disabled={!editTitle.trim()}
                        className="px-2 py-0.5 text-[10px] rounded bg-[#0A84FF] hover:bg-[#0A84FF]/80 text-white font-medium disabled:opacity-40"
                      >
                        Save
                      </button>
                    </div>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={transitionConfig}
                  className={`group flex items-start justify-between p-2 rounded-xl border transition-all ${
                    task.is_completed
                      ? 'bg-white/[0.02] border-white/[0.04] opacity-50'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08]'
                  }`}
                >
                  <div
                    className="flex items-start gap-2 flex-1 mr-2 cursor-pointer overflow-hidden"
                    onClick={() => toggleComplete(task.id)}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                        task.is_completed
                          ? 'bg-[#30D158] text-black'
                          : 'border border-white/40 group-hover:border-[#30D158]'
                      }`}
                    >
                      {task.is_completed && <CheckIcon size={9} strokeWidth={2.5} />}
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs truncate ${
                            task.is_completed
                              ? 'line-through text-white/40'
                              : 'text-white font-medium'
                          }`}
                        >
                          {task.title}
                        </span>

                        {getPriorityBadge(task.priority)}
                      </div>

                      {task.description && (
                        <span
                          className={`text-[10px] truncate mt-0.5 ${
                            task.is_completed ? 'line-through text-white/30' : 'text-white/50'
                          }`}
                        >
                          {task.description}
                        </span>
                      )}

                      {dueStatus && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                              task.is_completed
                                ? 'text-white/40 line-through bg-white/5'
                                : dueStatus.status === 'overdue'
                                ? 'text-[#FF453A] font-semibold bg-[#FF453A]/15'
                                : dueStatus.status === 'today'
                                ? 'text-[#FF9F0A] font-medium bg-[#FF9F0A]/15'
                                : 'text-white/60 bg-white/10'
                            }`}
                          >
                            {dueStatus.label}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(task);
                      }}
                      className="p-1 rounded text-white/40 hover:text-white transition-colors"
                      title="Edit task"
                    >
                      <EditIcon size={12} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTask(task.id);
                      }}
                      className="p-1 rounded text-white/40 hover:text-[#FF453A] transition-colors"
                      title="Delete task"
                    >
                      <TrashIcon size={12} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Footer Clear Completed Button */}
      {completedCount > 0 && (
        <div className="pt-1.5 border-t border-white/[0.06] mt-1 flex justify-end shrink-0">
          <button
            onClick={handleClearCompleted}
            className="text-[10px] text-white/50 hover:text-[#FF453A] transition-colors"
          >
            Clear completed ({completedCount})
          </button>
        </div>
      )}
    </div>
  );
};

export const TasksWidget: React.FC = () => {
  return (
    <GlassWidget>
      <TasksWidgetContent />
    </GlassWidget>
  );
};

export default TasksWidget;
