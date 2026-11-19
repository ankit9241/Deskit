import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDeadlineStore } from '@/stores/deadlineStore';
import { formatRelativeDeadline } from '@/lib/utils';
import { PlusIcon, TrashIcon, CheckIcon } from '@/components/shared/icons';
import { useWidgetDimensions } from '@/hooks/useWidgetDimensions';
import { useAppearanceStore } from '@/stores/appearanceStore';

export const DeadlinesWidget: React.FC = () => {
  const {
    deadlines,
    fetchDeadlines,
    addDeadline,
    toggleComplete,
    deleteDeadline,
    initListeners,
  } = useDeadlineStore();
  const { reducedMotion } = useAppearanceStore();
  const { isXs } = useWidgetDimensions();

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchDeadlines();
    const cleanup = initListeners();
    return () => {
      cleanup.then((fn) => fn && fn());
    };
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;
    addDeadline(title.trim(), dueDate);
    setTitle('');
    setDueDate('');
    setIsAdding(false);
  };

  const transitionConfig = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, damping: 25, stiffness: 400 };

  const sortedDeadlines = [...deadlines].sort((a, b) => {
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  // XS MICRO VIEW: Display only the nearest deadline
  if (isXs) {
    const nextDeadline = sortedDeadlines.find((d) => !d.is_completed);

    return (
      <div className="flex flex-col justify-between h-full w-full select-none text-[#F1EFE8]">
        <div className="flex items-center justify-between text-[10px] text-[#B7B3A9] mb-1">
          <span className="font-medium text-[#F1EFE8]">Next Deadline</span>
          <span className="text-[#C9A77D] text-[10px]">Due</span>
        </div>

        {nextDeadline ? (
          <div
            onClick={() => toggleComplete(nextDeadline.id)}
            className="flex flex-col p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] cursor-pointer transition-all"
          >
            <span className="text-xs font-medium text-[#F1EFE8] truncate">
              {nextDeadline.title}
            </span>
            <span className="text-[10px] text-[#C9A77D] font-mono mt-0.5">
              {formatRelativeDeadline(nextDeadline.due_date)}
            </span>
          </div>
        ) : (
          <div className="text-xs text-[#9DAE9B] text-center p-2 rounded-lg bg-white/[0.02]">
            No pending deadlines
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full select-none text-[#F1EFE8] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <span className="text-xs font-medium text-[#B7B3A9]">Deadlines</span>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="p-1 rounded btn-quiet"
          title="Add Deadline"
        >
          <PlusIcon size={12} />
        </button>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={transitionConfig}
            onSubmit={handleAdd}
            className="flex flex-col gap-1.5 mb-2.5 p-2 rounded-lg bg-[#242421]/60 border border-white/[0.06] shrink-0"
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Milestone title..."
              className="px-2 py-1 text-xs input-graphite text-[#F1EFE8]"
              autoFocus
            />
            <div className="flex items-center gap-1.5">
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1 px-2 py-0.5 text-xs input-graphite text-[#B7B3A9]"
              />
              <button
                type="submit"
                className="px-2.5 py-1 rounded btn-accent text-xs"
              >
                Save
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Deadlines List */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
        {sortedDeadlines.length === 0 ? (
          <div className="text-center text-xs text-[#858178] py-6">
            No deadlines scheduled
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {sortedDeadlines.map((item) => {
              const relativeTime = formatRelativeDeadline(item.due_date);
              const isOverdue = relativeTime.toLowerCase().includes('overdue');

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={transitionConfig}
                  className={`group flex items-center justify-between p-2 rounded-lg border transition-all ${
                    item.is_completed
                      ? 'bg-white/[0.01] border-white/[0.03] opacity-50'
                      : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06]'
                  }`}
                >
                  <div
                    className="flex flex-col flex-1 mr-2 cursor-pointer overflow-hidden"
                    onClick={() => toggleComplete(item.id)}
                  >
                    <span
                      className={`text-xs font-medium truncate ${
                        item.is_completed
                          ? 'line-through text-[#858178]'
                          : 'text-[#F1EFE8]'
                      }`}
                    >
                      {item.title}
                    </span>

                    <span
                      className={`text-[10px] font-mono mt-0.5 ${
                        item.is_completed
                          ? 'text-[#858178]'
                          : isOverdue
                          ? 'text-[#C58D85] font-medium'
                          : 'text-[#C9A77D]'
                      }`}
                    >
                      {relativeTime}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleComplete(item.id)}
                      className={`p-1 rounded transition-colors ${
                        item.is_completed
                          ? 'text-[#9DAE9B]'
                          : 'text-[#858178] hover:text-[#9DAE9B]'
                      }`}
                    >
                      <CheckIcon size={12} />
                    </button>

                    <button
                      onClick={() => deleteDeadline(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#858178] hover:text-[#C58D85] transition-all"
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
    </div>
  );
};
