import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useFocusStore } from '@/stores/focusStore';
import { onEvent } from '@/services/events';
import { formatTimeRemaining } from '@/lib/utils';
import { PlayIcon, PauseIcon, ResetIcon } from '@/components/shared/icons';
import { useWidgetDimensions } from '@/hooks/useWidgetDimensions';
import { useAppearanceStore } from '@/stores/appearanceStore';
import GlassWidget from '@/components/widgets/GlassWidget';

// Web Audio API chime on timer completion
function playCompletionChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(587.33, now, 0.4); // D5
    playTone(880.0, now + 0.15, 0.7); // A5
  } catch {}
}

export const FocusWidgetContent: React.FC = () => {
  const {
    session,
    fetchSession,
    startTimer,
    pauseTimer,
    resetTimer,
    addMinutes,
    tick,
    switchMode,
    setDurations,
    initListeners,
  } = useFocusStore();
  const { reducedMotion } = useAppearanceStore();
  const { isXs, isShort, isVeryShort } = useWidgetDimensions();
  const lastTickTimeRef = useRef<number>(Date.now());
  const prevRemainingRef = useRef<number | null>(null);

  // Manual configuration drawer
  const [showConfig, setShowConfig] = useState(false);
  const [customFocusMins, setCustomFocusMins] = useState<number>(25);
  const [customBreakMins, setCustomBreakMins] = useState<number>(5);

  useEffect(() => {
    fetchSession();
    const cleanup = initListeners();
    const unlistenCompleted = onEvent('focus-completed', () => {
      playCompletionChime();
    });
    return () => {
      cleanup.then((fn) => fn && fn());
      unlistenCompleted.then((fn) => fn && fn());
    };
  }, []);

  useEffect(() => {
    if (session) {
      setCustomFocusMins(session.duration_minutes || 25);
      setCustomBreakMins(session.break_minutes || 5);
    }
  }, [session?.duration_minutes, session?.break_minutes]);

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

  // Play audio chime when timer hits 0
  useEffect(() => {
    if (prevRemainingRef.current !== null && prevRemainingRef.current > 0 && session?.remaining_seconds === 0) {
      playCompletionChime();
    }
    prevRemainingRef.current = session?.remaining_seconds ?? null;
  }, [session?.remaining_seconds]);

  const safeSession = session || {
    id: 'default',
    duration_minutes: 25,
    break_minutes: 5,
    state: 'idle',
    remaining_seconds: 25 * 60,
    is_running: false,
    updated_at: new Date().toISOString(),
  };

  const isBreak = safeSession.state === 'break';
  const totalDuration = ((isBreak ? safeSession.break_minutes : safeSession.duration_minutes) || 25) * 60;
  const safeRemaining =
    typeof safeSession.remaining_seconds === 'number' && !isNaN(safeSession.remaining_seconds)
      ? safeSession.remaining_seconds
      : totalDuration;

  const progressFraction = Math.max(0, Math.min(1, 1 - safeRemaining / (totalDuration || 1500)));
  const strokeColor = isBreak ? '#30D158' : '#FF9F0A';

  // SVG viewBox ring calculations
  const circumference = 2 * Math.PI * 40; // radius 40 in 100x100 viewBox
  const strokeDashoffset = circumference * (1 - progressFraction);

  // Quick preset durations
  const focusPresets = [15, 25, 45, 60];
  const breakPresets = [5, 10, 15];

  const handleApplyDuration = async (fMins: number, bMins?: number) => {
    const focusVal = Math.max(1, Math.min(240, fMins));
    const breakVal = Math.max(1, Math.min(60, bMins ?? safeSession.break_minutes ?? 5));
    setCustomFocusMins(focusVal);
    setCustomBreakMins(breakVal);
    await setDurations(focusVal, breakVal);
    setShowConfig(false);
  };

  const handleQuickAdd5 = () => {
    addMinutes(5);
  };

  // MICRO / XS VIEW: Fluid compact horizontal pill layout
  if (isXs || isVeryShort) {
    return (
      <div className="flex items-center justify-between h-full w-full select-none text-white px-2">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mini progress circle */}
          <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
              <circle
                cx="18"
                cy="18"
                r="14.5"
                stroke="rgba(255, 255, 255, 0.18)"
                strokeWidth="3"
                fill="none"
              />
              <circle
                cx="18"
                cy="18"
                r="14.5"
                stroke={strokeColor}
                strokeWidth="3.2"
                fill="none"
                strokeDasharray="91.1"
                strokeDashoffset={91.1 * (1 - progressFraction)}
                strokeLinecap="round"
                className="transition-all duration-500 ease-linear"
              />
            </svg>
            <span className="absolute text-[9px] font-mono font-bold text-white drop-shadow-sm">
              {Math.round(progressFraction * 100)}%
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <span className="font-tabular font-bold text-lg leading-tight text-white tracking-tight truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
              {formatTimeRemaining(safeRemaining)}
            </span>
            <span className="text-[10px] text-white/70 font-medium capitalize truncate drop-shadow-sm">
              {safeSession.state || 'Ready'}
            </span>
          </div>
        </div>

        {/* Quick Play/Pause Action - Frosted Glass Button */}
        <button
          onClick={safeSession.is_running ? pauseTimer : startTimer}
          className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 active:bg-white/30 border border-white/25 backdrop-blur-md text-white transition-all shrink-0 shadow-lg flex items-center justify-center"
          title={safeSession.is_running ? 'Pause Timer' : 'Start Timer'}
        >
          {safeSession.is_running ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none text-white overflow-hidden py-0.5">
      {/* Top Header: Mac Segmented Mode Switcher & Duration Settings */}
      <div className="flex items-center justify-between w-full px-0.5 shrink-0">
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-black/40 border border-white/10 text-xs">
          <button
            onClick={() => switchMode('focus')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
              !isBreak
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            Focus
          </button>
          <button
            onClick={() => switchMode('break')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
              isBreak
                ? 'bg-[#30D158]/30 text-[#30D158] shadow-sm'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            Break
          </button>
        </div>

        {/* Manual Duration Settings Toggle */}
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`px-2 py-0.5 rounded-md text-[10px] font-mono border transition-all ${
            showConfig
              ? 'bg-[#FF9F0A]/20 border-[#FF9F0A]/50 text-[#FF9F0A]'
              : 'bg-white/[0.06] border-white/[0.10] text-white/60 hover:text-white'
          }`}
          title="Customize timer duration"
        >
          {safeSession.duration_minutes}m/{safeSession.break_minutes}m ▾
        </button>
      </div>

      {/* Manual Configuration Dropdown Panel */}
      {showConfig && (
        <div className="w-full my-1 p-2 rounded-xl bg-black/85 backdrop-blur-xl border border-white/15 shadow-2xl text-xs space-y-2 shrink-0 z-30">
          <div>
            <div className="text-[10px] text-white/60 mb-1 font-medium flex items-center justify-between">
              <span>Focus Duration</span>
              <span className="font-mono text-[#FF9F0A]">{customFocusMins} min</span>
            </div>
            <div className="flex items-center gap-1 mb-1.5 flex-wrap">
              {focusPresets.map((m) => (
                <button
                  key={m}
                  onClick={() => handleApplyDuration(m)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                    safeSession.duration_minutes === m
                      ? 'bg-[#FF9F0A] text-black font-semibold'
                      : 'bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                max="240"
                value={customFocusMins}
                onChange={(e) => setCustomFocusMins(parseInt(e.target.value) || 1)}
                className="w-14 px-1.5 py-0.5 text-xs bg-white/10 border border-white/15 rounded font-mono text-center outline-none text-white"
              />
              <span className="text-[10px] text-white/50">mins</span>
              <button
                onClick={() => handleApplyDuration(customFocusMins)}
                className="ml-auto px-2.5 py-0.5 rounded bg-[#FF9F0A] text-black text-[10px] font-semibold"
              >
                Set
              </button>
            </div>
          </div>

          <div className="pt-1.5 border-t border-white/10">
            <div className="text-[10px] text-white/60 mb-1 font-medium flex items-center justify-between">
              <span>Break Duration</span>
              <span className="font-mono text-[#30D158]">{customBreakMins} min</span>
            </div>
            <div className="flex items-center gap-1">
              {breakPresets.map((m) => (
                <button
                  key={m}
                  onClick={() => handleApplyDuration(safeSession.duration_minutes, m)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                    safeSession.break_minutes === m
                      ? 'bg-[#30D158] text-black font-semibold'
                      : 'bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hero Circular Progress Ring - Fully Responsive Scaling via ViewBox */}
      <div className="relative flex-1 min-h-[50px] max-h-[160px] aspect-square flex items-center justify-center my-auto py-1">
        <svg viewBox="0 0 100 100" className="w-full h-full max-h-full max-w-full transform -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="5"
            fill="none"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke={strokeColor}
            strokeWidth="5"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-linear"
          />
        </svg>

        {/* Center Time & Status */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <motion.span
            animate={safeSession.is_running && !reducedMotion ? { scale: [1, 1.015, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className={`font-tabular font-light tracking-tight text-white ${
              isShort ? 'text-xl font-normal' : 'text-3xl font-light'
            }`}
          >
            {formatTimeRemaining(safeRemaining)}
          </motion.span>
          <span className="text-[9px] uppercase tracking-wider text-white/50 font-medium mt-0.5">
            {safeSession.is_running ? safeSession.state : 'Ready'}
          </span>
        </div>
      </div>

      {/* Actions: Reset, Play/Pause, +5m */}
      <div className="flex items-center gap-2.5 shrink-0 mt-0.5">
        <button
          onClick={resetTimer}
          className="p-1.5 rounded-full btn-quiet text-white/50 hover:text-white"
          title="Reset Timer"
        >
          <ResetIcon size={12} />
        </button>

        <button
          onClick={safeSession.is_running ? pauseTimer : startTimer}
          className={`p-2 rounded-full flex items-center justify-center shadow-lg transition-all ${
            safeSession.is_running
              ? 'bg-white/20 text-white hover:bg-white/30'
              : 'bg-[#0A84FF] hover:bg-[#0077ED] text-white shadow-[#0A84FF]/25'
          }`}
          title={safeSession.is_running ? 'Pause' : 'Start'}
        >
          {safeSession.is_running ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
        </button>

        <button
          onClick={handleQuickAdd5}
          className="px-2 py-1 rounded-full btn-quiet text-[10px] font-mono text-white/60 hover:text-white"
          title="Add +5 Minutes"
        >
          +5m
        </button>
      </div>
    </div>
  );
};

export const FocusWidget: React.FC = () => {
  return (
    <GlassWidget>
      <FocusWidgetContent />
    </GlassWidget>
  );
};

export default FocusWidget;
