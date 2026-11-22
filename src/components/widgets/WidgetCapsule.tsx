import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { WidgetType } from '@/types/widget';
import {
  ClockIcon,
  TasksIcon,
  NotesIcon,
  DeadlinesIcon,
  GoalsIcon,
  PlayIcon,
  PauseIcon,
  CheckIcon,
} from '@/components/shared/icons';
import { useSettingsStore } from '@/stores/settingsStore';
import { useFocusStore } from '@/stores/focusStore';
import { useTaskStore } from '@/stores/taskStore';
import { useNoteStore } from '@/stores/noteStore';
import { useDeadlineStore } from '@/stores/deadlineStore';
import { useGoalStore } from '@/stores/goalStore';
import { formatTimeRemaining, formatRelativeDeadline } from '@/lib/utils';

export interface WidgetCapsuleProps {
  widgetType: WidgetType;
  onExpand: () => void;
}

export const WidgetCapsuleContent: React.FC<WidgetCapsuleProps> = ({ widgetType, onExpand }) => {
  // Stores
  const { settings } = useSettingsStore();
  const { session, startTimer, pauseTimer } = useFocusStore();
  const { tasks, toggleComplete: toggleTaskComplete } = useTaskStore();
  const { notes, activeNoteId } = useNoteStore();
  const { deadlines } = useDeadlineStore();
  const { goals } = useGoalStore();

  // Clock data
  const [now, setNow] = useState(new Date());
  React.useEffect(() => {
    if (widgetType === 'clock') {
      const t = setInterval(() => setNow(new Date()), 1000);
      return () => clearInterval(t);
    }
  }, [widgetType]);

  const timeFormat24 = settings?.time_format_24h ?? true;
  const rawHours = now.getHours();
  const hours = timeFormat24
    ? rawHours.toString().padStart(2, '0')
    : ((rawHours % 12) || 12).toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });

  // Safe Store Data Fallbacks
  const safeSession = session || {
    id: 'default',
    duration_minutes: 25,
    break_minutes: 5,
    state: 'idle',
    remaining_seconds: 25 * 60,
    is_running: false,
    updated_at: new Date().toISOString(),
  };
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeNotes = Array.isArray(notes) ? notes : [];
  const safeDeadlines = Array.isArray(deadlines) ? deadlines : [];
  const safeGoals = Array.isArray(goals) ? goals : [];

  // Tasks data
  const pendingTasks = safeTasks.filter((t) => !t.is_completed);
  const nextTask = pendingTasks[0];

  // Focus data
  const totalDuration =
    ((safeSession.state === 'break' ? safeSession.break_minutes : safeSession.duration_minutes) || 25) * 60;
  const remainingSecs =
    typeof safeSession.remaining_seconds === 'number' && !isNaN(safeSession.remaining_seconds)
      ? safeSession.remaining_seconds
      : totalDuration;
  const progress = totalDuration > 0 ? (totalDuration - remainingSecs) / totalDuration : 0;

  // Notes data
  const activeNote = safeNotes.find((n) => n.id === activeNoteId) || safeNotes[0];

  // Deadlines data
  const upcomingDeadlines = safeDeadlines
    .filter((d) => !d.is_completed)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const urgentDeadline = upcomingDeadlines[0];

  // Goals data
  const totalGoals = safeGoals.length;
  const completedToday = safeGoals.filter((g) => g.is_completed || g.current_count >= g.target_count).length;

  return (
    <motion.div
      layoutId="widget-shell"
      onClick={onExpand}
      className="flex items-center justify-between w-full h-full px-3.5 text-xs text-white cursor-pointer select-none overflow-hidden relative"
      title="Click to expand"
    >
      {/* CLOCK CAPSULE */}
      {widgetType === 'clock' && (
        <div className="flex items-center justify-between w-full font-tabular tracking-tight">
          <div className="flex items-center gap-1.5">
            <ClockIcon size={12} className="text-white/60 shrink-0" />
            <span className="font-semibold text-white">
              {hours}:{minutes}
            </span>
          </div>
          <span className="text-[10px] text-white/50 uppercase font-sans">
            {dateStr}
          </span>
        </div>
      )}

      {/* FOCUS CAPSULE */}
      {widgetType === 'focus' && (
        <div className="flex items-center justify-between w-full font-tabular">
          <div className="flex items-center gap-2 min-w-0">
            {/* Circular mini progress track */}
            <div className="relative w-3.5 h-3.5 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-white/20"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={safeSession.state === 'break' ? 'text-[#30D158]' : 'text-[#FF9F0A]'}
                  strokeDasharray={`${Math.round(progress * 100)}, 100`}
                  strokeWidth="4"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
            <span className="font-mono text-white text-xs font-semibold">
              {formatTimeRemaining(remainingSecs)}
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (safeSession.is_running) pauseTimer();
              else startTimer();
            }}
            className="no-drag p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            title={safeSession.is_running ? 'Pause' : 'Start'}
          >
            {safeSession.is_running ? <PauseIcon size={11} /> : <PlayIcon size={11} />}
          </button>
        </div>
      )}

      {/* TASKS CAPSULE */}
      {widgetType === 'tasks' && (
        <div className="flex items-center justify-between w-full min-w-0 gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <TasksIcon size={12} className="text-[#0A84FF] shrink-0" />
            <span className="truncate text-white/90 text-xs font-medium">
              {nextTask ? nextTask.title : 'All done'}
            </span>
          </div>
          {nextTask ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleTaskComplete(nextTask.id);
              }}
              className="no-drag w-4 h-4 rounded-full border border-white/30 hover:border-[#30D158] hover:bg-[#30D158]/20 flex items-center justify-center shrink-0 transition-colors"
              title="Mark task completed"
            >
              <CheckIcon size={9} className="text-white/60 hover:text-[#30D158]" />
            </button>
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] shrink-0" />
          )}
        </div>
      )}

      {/* NOTES CAPSULE */}
      {widgetType === 'notes' && (
        <div className="flex items-center justify-between w-full min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            <NotesIcon size={12} className="text-[#BF5AF2] shrink-0" />
            <span className="truncate text-white/90 text-xs font-medium">
              {activeNote ? activeNote.title : 'Quick Note'}
            </span>
          </div>
          <span className="text-[10px] text-white/40 shrink-0 font-mono">
            {activeNote ? 'Saved' : 'Empty'}
          </span>
        </div>
      )}

      {/* DEADLINES CAPSULE */}
      {widgetType === 'deadlines' && (
        <div className="flex items-center justify-between w-full min-w-0 gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <DeadlinesIcon size={12} className="text-[#FF453A] shrink-0" />
            <span className="truncate text-white/90 text-xs font-medium">
              {urgentDeadline ? urgentDeadline.title : 'No deadlines'}
            </span>
          </div>
          {urgentDeadline && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/80 shrink-0">
              {formatRelativeDeadline(urgentDeadline.due_date)}
            </span>
          )}
        </div>
      )}

      {/* GOALS CAPSULE */}
      {widgetType === 'goals' && (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5">
            <GoalsIcon size={12} className="text-[#30D158] shrink-0" />
            <span className="text-xs font-medium text-white/90">Daily Goals</span>
          </div>
          <span className="text-xs font-mono text-white/70">
            <span className="text-[#30D158] font-bold">{completedToday}</span>/{totalGoals}
          </span>
        </div>
      )}
    </motion.div>
  );
};

export const WidgetCapsule: React.FC<WidgetCapsuleProps> = (props) => {
  return <WidgetCapsuleContent {...props} />;
};

export default WidgetCapsule;
