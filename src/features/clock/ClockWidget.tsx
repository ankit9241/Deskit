import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSettingsStore } from '@/stores/settingsStore';
import { useWidgetDimensions } from '@/hooks/useWidgetDimensions';

export const ClockWidget: React.FC = () => {
  const [now, setNow] = useState(new Date());
  const { settings, toggleTimeFormat } = useSettingsStore();
  const { isXs, isS, isL } = useWidgetDimensions();

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const is24h = settings.time_format_24h;

  const rawHours = now.getHours();
  const hours = is24h
    ? rawHours.toString().padStart(2, '0')
    : ((rawHours % 12) || 12).toString().padStart(2, '0');

  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const ampm = rawHours >= 12 ? 'PM' : 'AM';

  const weekdayShort = now.toLocaleDateString(undefined, { weekday: 'short' });
  const weekdayFull = now.toLocaleDateString(undefined, { weekday: 'long' });
  const monthDay = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const year = now.getFullYear();

  const secondsInDay = rawHours * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const dayProgress = Math.round((secondsInDay / 86400) * 100);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full select-none text-[#F1EFE8] overflow-hidden">
      {/* Time Display with Tabular Numerals */}
      <div className="flex items-baseline justify-center tracking-tight font-tabular">
        <span
          className={`font-semibold tracking-tighter text-[#F1EFE8] ${
            isXs ? 'text-3xl' : isS ? 'text-4xl' : isL ? 'text-6xl' : 'text-5xl'
          }`}
        >
          {hours}
        </span>
        <motion.span
          animate={{ opacity: [1, 0.35, 1] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
          className={`text-[#C5B89D] px-0.5 ${
            isXs ? 'text-2xl' : isS ? 'text-3xl' : isL ? 'text-5xl' : 'text-4xl'
          }`}
        >
          :
        </motion.span>
        <span
          className={`font-semibold tracking-tighter text-[#F1EFE8] ${
            isXs ? 'text-3xl' : isS ? 'text-4xl' : isL ? 'text-6xl' : 'text-5xl'
          }`}
        >
          {minutes}
        </span>

        {/* Seconds */}
        {!isXs && (
          <span
            className={`font-normal text-[#858178] ml-1 tracking-normal ${
              isS ? 'text-base' : isL ? 'text-2xl' : 'text-xl'
            }`}
          >
            .{seconds}
          </span>
        )}

        {/* AM/PM */}
        {!is24h && (
          <span
            className={`font-medium text-[#C5B89D] tracking-wider uppercase ml-1.5 ${
              isXs ? 'text-[10px]' : 'text-xs'
            }`}
          >
            {ampm}
          </span>
        )}
      </div>

      {/* Date & 12/24 Mode Toggle */}
      <div
        className={`flex items-center gap-2 text-[#B7B3A9] transition-all ${
          isXs ? 'mt-1 text-[11px]' : isL ? 'mt-3 text-sm' : 'mt-1.5 text-xs'
        }`}
      >
        <span className="font-medium text-[#F1EFE8]">
          {isL ? weekdayFull : weekdayShort}
        </span>
        <span className="text-[#858178]">•</span>
        <span>{monthDay}</span>
        {isL && (
          <>
            <span className="text-[#858178]">•</span>
            <span>{year}</span>
          </>
        )}

        <button
          onClick={toggleTimeFormat}
          className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.10] text-[#B7B3A9] hover:text-[#F1EFE8] border border-[#F1EFE8]/[0.08] transition-all"
          title="Toggle 12/24 hour display"
        >
          {is24h ? '24H' : '12H'}
        </button>
      </div>

      {/* Expanded Tier L: Day Progress Indicator */}
      {isL && (
        <div className="w-48 mt-4 flex flex-col gap-1.5 items-center">
          <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#C5B89D] rounded-full transition-all duration-1000"
              style={{ width: `${dayProgress}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-[#858178] tracking-wider uppercase">
            {dayProgress}% of day elapsed
          </span>
        </div>
      )}
    </div>
  );
};
