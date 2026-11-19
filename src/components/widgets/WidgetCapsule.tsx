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

interface WidgetCapsuleProps {
  widgetType: WidgetType;
  onExpand: () => void;
}

export const WidgetCapsule: React.FC<WidgetCapsuleProps> = ({ widgetType, onExpand }) => {
  const [isHovered, setIsHovered] = useState(false);

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
  const totalDuration = ((safeSession.state === 'break' ? safeSession.break_minutes : safeSession.duration_minutes) || 25) * 60;
  const remainingSecs = typeof safeSession.remaining_seconds === 'number' && !isNaN(safeSession.remaining_seconds)
    ? safeSession.remaining_seconds
    : totalDuration;
  const progressFraction = Math.max(0, Math.min(1, 1 - remainingSecs / (totalDuration || 1500)));

  // Notes data
  const activeNote = safeNotes.find((n) => n.id === activeNoteId) || safeNotes[0];

  // Deadlines data
  const pendingDeadlines = [...safeDeadlines].filter((d) => !d.is_completed).sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );
  const nextDeadline = pendingDeadlines[0];

  // Goals data
  const completedGoals = safeGoals.filter((g) => g.is_completed).length;

  return (
    <motion.div
      onClick={onExpand}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-auto h-[36px] px-3.5 capsule-surface flex items-center justify-between gap-3 select-none cursor-pointer text-[#F1EFE8] shrink-0"
      data-tauri-drag-region
    >
      {/* 1. CLOCK CAPSULE */}
      {widgetType === 'clock' && (
        <div data-tauri-drag-region className="flex items-center justify-between w-full pointer-events-none">
          <div className="flex items-center gap-1.5">
            <ClockIcon size={13} className="text-[#C5B89D] shrink-0" />
            <span className="font-tabular text-xs font-medium tracking-tight text-[#F1EFE8]">
              {hours}:{minutes}
            </span>
          </div>

          <span className="text-[10px] text-[#B7B3A9] font-medium tracking-tight">
            {isHovered ? dateStr : timeFormat24 ? '24H' : rawHours >= 12 ? 'PM' : 'AM'}
          </span>
        </div>
      )}

      {/* 2. FOCUS TIMER CAPSULE */}
      {widgetType === 'focus' && (
        <div data-tauri-drag-region className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5 pointer-events-none">
            {/* Mini SVG Progress Ring */}
            <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
              <svg width="16" height="16" className="transform -rotate-90">
                <circle cx="8" cy="8" r="6" stroke="rgba(241,239,232,0.12)" strokeWidth="1.5" fill="none" />
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  stroke={safeSession.state === 'break' ? '#9DAE9B' : '#C5B89D'}
                  strokeWidth="1.75"
                  strokeDasharray="37.7"
                  strokeDashoffset={37.7 * (1 - progressFraction)}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </div>
            <span className="font-tabular text-xs font-medium tracking-tight text-[#F1EFE8]">
              {formatTimeRemaining(remainingSecs)}
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (safeSession.is_running) pauseTimer();
              else startTimer();
            }}
            className="p-1 rounded-full text-[#B7B3A9] hover:text-[#F1EFE8] hover:bg-white/[0.08] transition-colors"
            title={safeSession.is_running ? 'Pause' : 'Start'}
          >
            {safeSession.is_running ? <PauseIcon size={10} /> : <PlayIcon size={10} />}
          </button>
        </div>
      )}

      {/* 3. TASKS CAPSULE */}
      {widgetType === 'tasks' && (
        <div data-tauri-drag-region className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5 overflow-hidden mr-1 pointer-events-none">
            <TasksIcon size={13} className="text-[#C5B89D] shrink-0" />
            <span className="text-xs text-[#F1EFE8] truncate font-medium max-w-[85px]">
              {nextTask ? nextTask.title : 'All caught up'}
            </span>
          </div>

          {nextTask ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleTaskComplete(nextTask.id);
              }}
              className="w-4 h-4 rounded-full border border-[#B7B3A9]/40 hover:border-[#9DAE9B] hover:bg-[#9DAE9B]/15 flex items-center justify-center text-transparent hover:text-[#9DAE9B] transition-all shrink-0"
              title="Complete task"
            >
              <CheckIcon size={10} />
            </button>
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-[#9DAE9B] shrink-0" />
          )}
        </div>
      )}

      {/* 4. NOTES CAPSULE */}
      {widgetType === 'notes' && (
        <div data-tauri-drag-region className="flex items-center justify-between w-full pointer-events-none">
          <div className="flex items-center gap-1.5 overflow-hidden mr-1">
            <NotesIcon size={13} className="text-[#C5B89D] shrink-0" />
            <span className="text-xs text-[#F1EFE8] truncate font-medium max-w-[95px]">
              {activeNote?.title || 'Scratchpad'}
            </span>
          </div>
          <span className="text-[10px] text-[#9DAE9B] font-mono shrink-0">Saved</span>
        </div>
      )}

      {/* 5. DEADLINES CAPSULE */}
      {widgetType === 'deadlines' && (
        <div data-tauri-drag-region className="flex items-center justify-between w-full pointer-events-none">
          <div className="flex items-center gap-1.5 overflow-hidden mr-1">
            <DeadlinesIcon size={13} className="text-[#C5B89D] shrink-0" />
            <span className="text-xs text-[#F1EFE8] truncate font-medium max-w-[80px]">
              {nextDeadline?.title || 'No deadlines'}
            </span>
          </div>
          {nextDeadline && (
            <span className="text-[10px] text-[#C9A77D] font-mono shrink-0">
              {formatRelativeDeadline(nextDeadline.due_date)}
            </span>
          )}
        </div>
      )}

      {/* 6. GOALS CAPSULE */}
      {widgetType === 'goals' && (
        <div data-tauri-drag-region className="flex items-center justify-between w-full pointer-events-none">
          <div className="flex items-center gap-1.5">
            <GoalsIcon size={13} className="text-[#9DAE9B] shrink-0" />
            <span className="text-xs text-[#F1EFE8] font-medium">Goals</span>
          </div>
          <span className="text-[10px] font-mono text-[#9DAE9B] bg-[#9DAE9B]/10 px-1.5 py-0.2 rounded-full">
            {completedGoals}/{safeGoals.length}
          </span>
        </div>
      )}
    </motion.div>
  );
};
