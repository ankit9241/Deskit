import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskStore } from '@/stores/taskStore';
import { TaskPriority } from '@/types/task';
import { PlusIcon, TrashIcon, CheckIcon } from '@/components/shared/icons';
import { useWidgetDimensions } from '@/hooks/useWidgetDimensions';
import { useAppearanceStore } from '@/stores/appearanceStore';

export const TasksWidget: React.FC = () => {
  const { tasks, isLoading, fetchTasks, addTask, toggleComplete, deleteTask, initListeners } =
    useTaskStore();
  const { reducedMotion } = useAppearanceStore();
  const { isXs, isL } = useWidgetDimensions();

  const [newTitle, setNewTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

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
    addTask(newTitle.trim(), priority);
    setNewTitle('');
  };

  const pendingCount = tasks.filter((t) => !t.is_completed).length;

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'active') return !t.is_completed;
    if (filter === 'completed') return t.is_completed;
    return true;
  });

  const transitionConfig = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, damping: 25, stiffness: 400 };

  // XS MICRO VIEW: Display only the primary active task + count
  if (isXs) {
    const nextTask = tasks.find((t) => !t.is_completed);

    return (
      <div className="flex flex-col justify-between h-full w-full select-none text-[#F1EFE8]">
        <div className="flex items-center justify-between text-[11px] text-[#B7B3A9] mb-1">
          <span className="font-medium text-[#F1EFE8]">Next Task</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/[0.05] text-[10px] text-[#C5B89D] font-mono">
            {pendingCount} left
          </span>
        </div>

        {nextTask ? (
          <div
            onClick={() => toggleComplete(nextTask.id)}
            className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] cursor-pointer transition-all"
          >
            <div className="w-3.5 h-3.5 rounded-full border border-[#B7B3A9]/40 hover:border-[#9DAE9B] shrink-0" />
            <span className="text-xs text-[#F1EFE8] truncate font-medium flex-1">
              {nextTask.title}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs text-[#9DAE9B]">
            <CheckIcon size={13} className="mr-1" /> All tasks completed
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full select-none text-[#F1EFE8] overflow-hidden">
      {/* Header Info & Filter Tabs */}
      <div className="flex items-center justify-between gap-1 mb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[#B7B3A9]">Tasks</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/[0.06] text-[10px] font-mono text-[#C5B89D]">
            {pendingCount}
          </span>
        </div>

        {isL && (
          <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-[#242421]/60 border border-white/[0.06] text-[10px]">
            {(['all', 'active', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2 py-0.5 rounded capitalize transition-all ${
                  filter === tab
                    ? 'bg-white/[0.10] text-[#F1EFE8] font-medium'
                    : 'text-[#858178] hover:text-[#B7B3A9]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Task Creation Bar */}
      <form onSubmit={handleAdd} className="flex items-center gap-1.5 mb-2.5 shrink-0">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New task..."
          className="flex-1 px-2.5 py-1 text-xs input-graphite text-[#F1EFE8]"
        />

        {isL && (
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="px-2 py-1 text-xs input-graphite bg-[#242421] text-[#B7B3A9] cursor-pointer"
          >
            <option value="low">Low</option>
            <option value="medium">Med</option>
            <option value="high">High</option>
          </select>
        )}

        <button
          type="submit"
          className="p-1 rounded-md btn-accent flex items-center justify-center shrink-0"
          title="Add task"
        >
          <PlusIcon size={14} />
        </button>
      </form>

      {/* Scrollable Task Items */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
        {isLoading && tasks.length === 0 ? (
          <div className="text-center text-xs text-[#858178] py-4">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center text-xs text-[#858178] py-6">
            No tasks in this view
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredTasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={transitionConfig}
                className={`group flex items-center justify-between p-2 rounded-lg border transition-all ${
                  task.is_completed
                    ? 'bg-white/[0.01] border-white/[0.03] text-[#858178]'
                    : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06] text-[#F1EFE8]'
                }`}
              >
                {/* Checkbox and Title */}
                <div
                  className="flex items-center gap-2 flex-1 cursor-pointer overflow-hidden mr-1"
                  onClick={() => toggleComplete(task.id)}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                      task.is_completed
                        ? 'bg-[#9DAE9B] border-[#9DAE9B] text-[#242421]'
                        : 'border-white/25 group-hover:border-[#C5B89D] text-transparent'
                    }`}
                  >
                    <CheckIcon size={9} strokeWidth={2.5} className={task.is_completed ? 'opacity-100' : 'opacity-0'} />
                  </div>

                  <span
                    className={`text-xs truncate transition-all ${
                      task.is_completed
                        ? 'line-through text-[#858178]'
                        : 'text-[#F1EFE8] font-normal'
                    }`}
                  >
                    {task.title}
                  </span>
                </div>

                {/* Priority & Delete Controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {task.priority === 'high' && !task.is_completed && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C58D85]" title="High priority" />
                  )}
                  {task.priority === 'medium' && !task.is_completed && isL && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C9A77D]" title="Medium priority" />
                  )}

                  <button
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#858178] hover:text-[#C58D85] transition-all"
                    title="Delete task"
                  >
                    <TrashIcon size={12} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
