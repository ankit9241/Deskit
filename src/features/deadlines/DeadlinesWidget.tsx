import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDeadlineStore } from '@/stores/deadlineStore';
import { formatRelativeDeadline } from '@/lib/utils';
import { PlusIcon, TrashIcon, CheckIcon } from '@/components/shared/icons';
import { useWidgetDimensions } from '@/hooks/useWidgetDimensions';
import { useAppearanceStore } from '@/stores/appearanceStore';
import GlassWidget from '@/components/widgets/GlassWidget';

export const DeadlinesWidgetContent: React.FC = () => {
  const {
    deadlines,
    fetchDeadlines,
    addDeadline,
    toggleComplete,
    deleteDeadline,
    initListeners,
  } = useDeadlineStore();
  const { reducedMotion } = useAppearanceStore();
  const { isXs, isVeryShort } = useWidgetDimensions();

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('General');
  const [notifyLeadMinutes, setNotifyLeadMinutes] = useState(15);
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
    addDeadline(title.trim(), dueDate, category, notifyLeadMinutes);
    setTitle('');
    setDueDate('');
    setIsAdding(false);
  };

  const handleQuickDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    d.setHours(18, 0, 0, 0); // Default to 6:00 PM
    const iso = d.toISOString().slice(0, 16);
    setDueDate(iso);
  };

  const transitionConfig = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, damping: 25, stiffness: 400 };

  const sortedDeadlines = [...deadlines].sort((a, b) => {
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  // MICRO / XS VIEW: Display only the nearest deadline
  if (isXs || isVeryShort) {
    const nextDeadline = sortedDeadlines.find((d) => !d.is_completed);

    return (
      <div className="flex flex-col justify-between h-full w-full select-none text-white p-0.5">
        <div className="flex items-center justify-between text-[10px] text-white/60 mb-1">
          <span className="font-semibold text-white">Next Deadline</span>
          <span className="text-[#FF9F0A] text-[10px]">Due</span>
        </div>

        {nextDeadline ? (
          <div
            onClick={() => toggleComplete(nextDeadline.id)}
            className="flex flex-col p-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] cursor-pointer transition-all"
          >
            <span className="text-xs font-medium text-white truncate">
              {nextDeadline.title}
            </span>
            <span className="text-[10px] text-[#FF9F0A] font-mono mt-0.5">
              {formatRelativeDeadline(nextDeadline.due_date)}
            </span>
          </div>
        ) : (
          <div className="text-xs text-[#30D158] text-center p-1.5 rounded-lg bg-white/[0.03]">
            No pending deadlines
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full select-none text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <span className="text-xs font-semibold text-white">Deadlines</span>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`p-1 rounded-lg transition-colors ${
            isAdding ? 'bg-white/20 text-white' : 'btn-quiet'
          }`}
          title="Add Deadline"
        >
          <PlusIcon size={12} />
        </button>
      </div>

      {/* Add Form with Manual Options */}
      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={transitionConfig}
            onSubmit={handleAdd}
            className="flex flex-col gap-1.5 mb-2.5 p-2 rounded-xl bg-black/50 border border-white/15 shrink-0"
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Milestone title..."
              className="px-2 py-1 text-xs bg-white/10 border border-white/15 rounded-lg outline-none text-white placeholder-white/40"
              autoFocus
            />

            {/* Quick Date Shortcuts */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] text-white/50">Quick:</span>
              <button
                type="button"
                onClick={() => handleQuickDate(0)}
                className="px-1.5 py-0.2 rounded bg-white/10 hover:bg-white/20 text-[9px] text-white/70"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleQuickDate(1)}
                className="px-1.5 py-0.2 rounded bg-white/10 hover:bg-white/20 text-[9px] text-white/70"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => handleQuickDate(3)}
                className="px-1.5 py-0.2 rounded bg-white/10 hover:bg-white/20 text-[9px] text-white/70"
              >
                +3 Days
              </button>
              <button
                type="button"
                onClick={() => handleQuickDate(7)}
                className="px-1.5 py-0.2 rounded bg-white/10 hover:bg-white/20 text-[9px] text-white/70"
              >
                +1 Week
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1 min-w-[130px] px-2 py-0.5 text-xs bg-white/10 border border-white/15 rounded-lg outline-none text-white/80"
              />

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-2 py-0.5 text-xs bg-white/10 border border-white/15 rounded-lg outline-none text-white/80 cursor-pointer"
              >
                <option value="General" className="bg-[#1C1C1E]">General</option>
                <option value="Work" className="bg-[#1C1C1E]">Work</option>
                <option value="Personal" className="bg-[#1C1C1E]">Personal</option>
                <option value="Urgent" className="bg-[#1C1C1E]">Urgent</option>
              </select>

              <select
                value={notifyLeadMinutes}
                onChange={(e) => setNotifyLeadMinutes(Number(e.target.value))}
                className="px-2 py-0.5 text-xs bg-white/10 border border-white/15 rounded-lg outline-none text-white/80 cursor-pointer"
                title="Notification alert timing"
              >
                <option value={0} className="bg-[#1C1C1E]">At due time</option>
                <option value={15} className="bg-[#1C1C1E]">15m before</option>
                <option value={60} className="bg-[#1C1C1E]">1h before</option>
                <option value={1440} className="bg-[#1C1C1E]">1d before</option>
              </select>

              <button
                type="submit"
                className="px-2.5 py-1 rounded-lg btn-accent text-xs shrink-0"
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
          <div className="text-center text-xs text-white/40 py-6">
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
                  className={`group flex items-center justify-between p-2 rounded-xl border transition-all ${
                    item.is_completed
                      ? 'bg-white/[0.02] border-white/[0.04] opacity-50'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08]'
                  }`}
                >
                  <div
                    className="flex flex-col flex-1 mr-2 cursor-pointer overflow-hidden"
                    onClick={() => toggleComplete(item.id)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-medium truncate ${
                          item.is_completed
                            ? 'line-through text-white/40'
                            : 'text-white'
                        }`}
                      >
                        {item.title}
                      </span>
                      {item.category && item.category !== 'General' && (
                        <span className="px-1 py-0.2 rounded-full bg-white/10 text-[9px] text-white/70">
                          {item.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`text-[10px] font-mono ${
                          item.is_completed
                            ? 'text-white/40'
                            : isOverdue
                            ? 'text-[#FF453A] font-semibold'
                            : 'text-[#FF9F0A]'
                        }`}
                      >
                        {relativeTime}
                      </span>
                      {item.notify_lead_minutes !== undefined && !item.is_completed && (
                        <span className="text-[9px] text-white/35">
                          • {item.notify_lead_minutes === 0 ? 'at due' : `${item.notify_lead_minutes}m alert`}
                        </span>
                      )}
                      {item.notified_due && !item.is_completed && (
                        <span className="px-1 rounded bg-[#FF453A]/20 text-[#FF453A] text-[8px] font-semibold">
                          alerted
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleComplete(item.id)}
                      className={`p-1 rounded-lg transition-colors ${
                        item.is_completed
                          ? 'text-[#30D158]'
                          : 'text-white/40 hover:text-[#30D158]'
                      }`}
                    >
                      <CheckIcon size={12} />
                    </button>

                    <button
                      onClick={() => deleteDeadline(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-[#FF453A] transition-all"
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

export const DeadlinesWidget: React.FC = () => {
  return (
    <GlassWidget>
      <DeadlinesWidgetContent />
    </GlassWidget>
  );
};

export default DeadlinesWidget;
