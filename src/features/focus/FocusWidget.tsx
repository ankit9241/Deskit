import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useFocusStore } from '@/stores/focusStore';
import { formatTimeRemaining } from '@/lib/utils';
import { PlayIcon, PauseIcon, ResetIcon } from '@/components/shared/icons';
import { useWidgetDimensions } from '@/hooks/useWidgetDimensions';
import { useAppearanceStore } from '@/stores/appearanceStore';

export const FocusWidget: React.FC = () => {
  const {
    session,
    fetchSession,
    startTimer,
    pauseTimer,
    resetTimer,
    tick,
    switchMode,
    initListeners,
  } = useFocusStore();
  const { reducedMotion } = useAppearanceStore();
  const { isXs, isS, isL } = useWidgetDimensions();
  const lastTickTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    fetchSession();
    const cleanup = initListeners();
    return () => {
      cleanup.then((fn) => fn && fn());
    };
  }, []);

  // Real-time elapsed interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (session?.is_running) {
      lastTickTimeRef.current = Date.now();
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - lastTickTimeRef.current) / 1000);
        if (elapsed >= 1) {
          lastTickTimeRef.current = now;
          tick();
        }
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session?.is_running, tick]);

  const safeSession = session || {
    id: 'default',
    duration_minutes: 25,
    break_minutes: 5,
    state: 'idle',
    remaining_seconds: 25 * 60,
    is_running: false,
    updated_at: new Date().toISOString(),
  };

  const totalDuration =
    ((safeSession.state === 'break' ? safeSession.break_minutes : safeSession.duration_minutes) || 25) * 60;

  const safeRemaining =
    typeof safeSession.remaining_seconds === 'number' && !isNaN(safeSession.remaining_seconds)
      ? safeSession.remaining_seconds
      : totalDuration;

  const progressFraction = Math.max(
    0,
    Math.min(1, 1 - safeRemaining / (totalDuration || 1500))
  );

  const isBreak = safeSession.state === 'break';
  const strokeColor = isBreak ? '#9DAE9B' : '#C5B89D';

  const radius = isXs ? 24 : isS ? 44 : isL ? 68 : 52;
  const strokeWidth = isXs ? 3 : isS ? 4 : 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressFraction);

  // XS MICRO VIEW: Compact inline pill
  if (isXs) {
    return (
      <div className="flex items-center justify-between h-full w-full select-none text-[#F1EFE8] px-1">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <svg
              width={(radius + strokeWidth) * 2}
              height={(radius + strokeWidth) * 2}
              className="transform -rotate-90"
            >
              <circle
                cx={radius + strokeWidth}
                cy={radius + strokeWidth}
                r={radius}
                stroke="rgba(241, 239, 232, 0.08)"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              <circle
                cx={radius + strokeWidth}
                cy={radius + strokeWidth}
                r={radius}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-medium text-[#F1EFE8]">
              {Math.round(progressFraction * 100)}%
            </div>
          </div>

          <div className="flex flex-col">
            <span className="font-tabular font-medium text-base text-[#F1EFE8]">
              {formatTimeRemaining(safeRemaining)}
            </span>
            <span className="text-[10px] text-[#B7B3A9] capitalize">
              {safeSession.state || 'idle'}
            </span>
          </div>
        </div>

        <button
          onClick={safeSession.is_running ? pauseTimer : startTimer}
          className="p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#F1EFE8] transition-all"
        >
          {safeSession.is_running ? <PauseIcon size={11} /> : <PlayIcon size={11} />}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none text-[#F1EFE8] overflow-hidden py-1">
      {/* Mode Switcher */}
      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#242421]/60 border border-white/[0.06] text-xs">
        <button
          onClick={() => switchMode('focus')}
          className={`px-3 py-0.5 rounded-md text-[11px] font-medium transition-all ${
            !isBreak
              ? 'bg-[#C5B89D] text-[#242421]'
              : 'text-[#858178] hover:text-[#B7B3A9]'
          }`}
        >
          Focus
        </button>
        <button
          onClick={() => switchMode('break')}
          className={`px-3 py-0.5 rounded-md text-[11px] font-medium transition-all ${
            isBreak
              ? 'bg-[#9DAE9B] text-[#242421]'
              : 'text-[#858178] hover:text-[#B7B3A9]'
          }`}
        >
          Break
        </button>
      </div>

      {/* Hero Circular Progress Ring */}
      <div className="relative flex items-center justify-center my-auto py-1">
        <svg
          width={(radius + strokeWidth) * 2}
          height={(radius + strokeWidth) * 2}
          className="transform -rotate-90"
        >
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke="rgba(241, 239, 232, 0.08)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        {/* Center Time & Status */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <motion.span
            animate={safeSession.is_running && !reducedMotion ? { scale: [1, 1.01, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className={`font-tabular font-light tracking-tight text-[#F1EFE8] ${
              isS ? 'text-2xl font-normal' : isL ? 'text-4xl font-light' : 'text-3xl'
            }`}
          >
            {formatTimeRemaining(safeRemaining)}
          </motion.span>
          <span className="text-[10px] uppercase tracking-wider text-[#B7B3A9] font-medium mt-0.5">
            {safeSession.is_running ? safeSession.state : 'Ready'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={resetTimer}
          className="p-1.5 rounded-full btn-quiet text-[#858178] hover:text-[#F1EFE8]"
          title="Reset Timer"
        >
          <ResetIcon size={12} />
        </button>

        <button
          onClick={safeSession.is_running ? pauseTimer : startTimer}
          className="p-2 rounded-full btn-accent flex items-center justify-center"
          title={safeSession.is_running ? 'Pause' : 'Start'}
        >
          {safeSession.is_running ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
        </button>
      </div>
    </div>
  );
};
