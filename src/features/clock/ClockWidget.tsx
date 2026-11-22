import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '@/stores/settingsStore';
import { useClockStore } from '@/stores/clockStore';
import { useWidgetDimensions } from '@/hooks/useWidgetDimensions';
import GlassWidget from '@/components/widgets/GlassWidget';
import {
  ClockIcon,
  GlobeIcon,
  BellIcon,
  PlusIcon,
  TrashIcon,
} from '@/components/shared/icons';
import { Alarm } from '@/types/clock';

const POPULAR_CITIES = [
  { city: 'New York', tz: 'America/New_York' },
  { city: 'London', tz: 'Europe/London' },
  { city: 'Tokyo', tz: 'Asia/Tokyo' },
  { city: 'Paris', tz: 'Europe/Paris' },
  { city: 'Sydney', tz: 'Australia/Sydney' },
  { city: 'Dubai', tz: 'Asia/Dubai' },
  { city: 'Singapore', tz: 'Asia/Singapore' },
  { city: 'San Francisco', tz: 'America/Los_Angeles' },
  { city: 'New Delhi', tz: 'Asia/Kolkata' },
  { city: 'Auckland', tz: 'Pacific/Auckland' },
];

const WEEKDAY_LABELS = [
  { day: 1, label: 'M' },
  { day: 2, label: 'T' },
  { day: 3, label: 'W' },
  { day: 4, label: 'T' },
  { day: 5, label: 'F' },
  { day: 6, label: 'S' },
  { day: 7, label: 'S' },
];

export const ClockWidgetContent: React.FC = () => {
  const [now, setNow] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'clock' | 'world' | 'alarms'>('clock');
  const [showAddCity, setShowAddCity] = useState(false);
  const [showAddAlarm, setShowAddAlarm] = useState(false);

  // New city form
  const [newCityName, setNewCityName] = useState('');
  const [newCityTz, setNewCityTz] = useState('America/New_York');

  // New alarm form
  const [alarmTitle, setAlarmTitle] = useState('Alarm');
  const [alarmTime, setAlarmTime] = useState('08:00');
  const [alarmIsRecurring, setAlarmIsRecurring] = useState(true);
  const [alarmDays, setAlarmDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const {
    settings,
    toggleTimeFormat,
    toggleSeconds,
    fetchSettings,
    initListeners: initSettingsListeners,
  } = useSettingsStore();

  const {
    worldClocks,
    alarms,
    ringingAlarm,
    fetchClockData,
    addWorldClock,
    removeWorldClock,
    saveAlarm,
    toggleAlarm,
    deleteAlarm,
    dismissAlarm,
    initListeners: initClockListeners,
  } = useClockStore();

  const { isXs, isL, isShort, isVeryShort, isNarrow, isVeryNarrow, isWide } = useWidgetDimensions();
  const isCompact = isXs || isVeryShort || isVeryNarrow;
  const isLarge = isL || isWide;

  // Play Web Audio alarm chime rhythmically while ringingAlarm is active
  useEffect(() => {
    if (!ringingAlarm) return;

    let audioCtx: AudioContext | null = null;
    let intervalId: any = null;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    } catch {}

    const playBeep = () => {
      if (!audioCtx) return;
      try {
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        const now = audioCtx.currentTime;
        const playTone = (freq: number, start: number, dur: number) => {
          const osc = audioCtx!.createOscillator();
          const gain = audioCtx!.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.2, start);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
          osc.connect(gain);
          gain.connect(audioCtx!.destination);
          osc.start(start);
          osc.stop(start + dur);
        };
        // Dual-tone alarm chime
        playTone(880, now, 0.12);
        playTone(880, now + 0.16, 0.12);
        playTone(1046.5, now + 0.32, 0.22);
      } catch {}
    };

    playBeep();
    intervalId = setInterval(playBeep, 1500);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (audioCtx) {
        try {
          audioCtx.close();
        } catch {}
      }
    };
  }, [ringingAlarm]);

  useEffect(() => {
    fetchSettings();
    fetchClockData();

    let cleanSettings: (() => void) | undefined;
    let cleanClock: (() => void) | undefined;

    initSettingsListeners().then((unsub) => {
      cleanSettings = unsub;
    });

    initClockListeners().then((unsub) => {
      cleanClock = unsub;
    });

    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
      if (cleanSettings) cleanSettings();
      if (cleanClock) cleanClock();
    };
  }, [fetchSettings, fetchClockData, initSettingsListeners, initClockListeners]);

  const is24h = settings.time_format_24h;
  const showSeconds = settings.show_seconds;

  // Primary Clock Formatting
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

  // Handlers
  const handleCreateCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityName.trim() || !newCityTz.trim()) return;
    try {
      await addWorldClock(newCityName.trim(), newCityTz.trim());
      setNewCityName('');
      setShowAddCity(false);
    } catch (err) {
      alert(`Invalid timezone: ${err}`);
    }
  };

  const handleCreateAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alarmTime) return;
    try {
      const newAlarm: Alarm = {
        id: '',
        title: alarmTitle.trim() || 'Alarm',
        time_str: alarmTime,
        days_of_week: alarmIsRecurring ? alarmDays : [],
        is_enabled: true,
        is_recurring: alarmIsRecurring,
        one_time_date: alarmIsRecurring ? null : now.toISOString().split('T')[0],
      };
      await saveAlarm(newAlarm);
      setShowAddAlarm(false);
    } catch (err) {
      alert(`Error saving alarm: ${err}`);
    }
  };

  const toggleAlarmDay = (day: number) => {
    if (alarmDays.includes(day)) {
      setAlarmDays(alarmDays.filter((d) => d !== day));
    } else {
      setAlarmDays([...alarmDays, day].sort());
    }
  };

  const activeAlarmsCount = alarms.filter((a) => a.is_enabled).length;

  return (
    <div className="flex flex-col h-full w-full select-none text-white overflow-hidden py-1 px-1">
      {/* Active Ringing Alarm Card */}
      {ringingAlarm && (
        <div className="mb-1 p-1.5 sm:p-2 rounded bg-red-600/30 border border-red-500 flex items-center justify-between shadow-lg shadow-red-500/20 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-500 flex items-center justify-center text-white shrink-0">
              <BellIcon size={12} className="animate-bounce" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-wider text-red-300">Alarm Ringing</div>
              <div className="text-xs font-semibold text-white font-tabular truncate">
                {ringingAlarm.time_str} • {ringingAlarm.title}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismissAlarm(ringingAlarm.id)}
            className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-red-500 hover:bg-red-400 text-white font-bold text-[10px] sm:text-[11px] rounded shadow transition-all active:scale-95 cursor-pointer shrink-0 no-drag"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Top Header Mode Tabs - always accessible, adaptively renders compact icon-only or full tabs */}
      <div className={`flex items-center justify-between pb-1 px-1 border-b border-white/[0.08] mb-1 shrink-0 ${isCompact ? 'gap-1' : 'gap-2'}`}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('clock')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-all no-drag ${
              activeTab === 'clock'
                ? 'bg-white/20 text-white font-semibold'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="Clock"
          >
            <ClockIcon size={11} />
            {!isCompact && <span>Clock</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('world')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-all no-drag ${
              activeTab === 'world'
                ? 'bg-white/20 text-white font-semibold'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="World Clocks"
          >
            <GlobeIcon size={11} />
            {!isCompact && <span>World</span>}
            {worldClocks.length > 0 && (
              <span className="text-[9px] px-1 rounded-full bg-white/10">{worldClocks.length}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('alarms')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-all no-drag ${
              activeTab === 'alarms'
                ? 'bg-white/20 text-white font-semibold'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="Desktop Alarms"
          >
            <BellIcon size={11} />
            {!isCompact && <span>Alarms</span>}
            {activeAlarmsCount > 0 && (
              <span className="text-[9px] px-1 rounded-full bg-[#0A84FF]/40 text-[#0A84FF]">
                {activeAlarmsCount}
              </span>
            )}
          </button>
        </div>

        {/* Quick controls on header */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={toggleTimeFormat}
            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80 border border-white/10 transition-all no-drag"
            title="Toggle 12/24 hour display"
          >
            {is24h ? '24H' : '12H'}
          </button>
          <button
            type="button"
            onClick={toggleSeconds}
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-all no-drag ${
              showSeconds
                ? 'bg-[#0A84FF]/25 border-[#0A84FF]/40 text-[#0A84FF]'
                : 'bg-white/10 border-white/10 text-white/50'
            }`}
            title="Toggle seconds display"
          >
            :sec
          </button>
        </div>
      </div>

      {/* Content Switcher */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
        {/* VIEW 1: Primary Clock */}
        {activeTab === 'clock' && (
          <div className="flex flex-col items-center justify-center w-full min-h-full my-auto py-2">
            {/* Time Display with Tabular Numerals */}
            <div className="flex items-baseline justify-center tracking-tight font-tabular">
              <span
                className={`font-semibold tracking-tighter text-white ${
                  isCompact
                    ? 'text-2xl sm:text-3xl'
                    : isShort || isNarrow
                    ? 'text-4xl'
                    : isLarge
                    ? 'text-6xl sm:text-7xl lg:text-8xl'
                    : 'text-5xl'
                }`}
              >
                {hours}
              </span>
              <motion.span
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                className={`text-[#0A84FF] px-0.5 ${
                  isCompact
                    ? 'text-xl sm:text-2xl'
                    : isShort || isNarrow
                    ? 'text-3xl'
                    : isLarge
                    ? 'text-5xl sm:text-6xl lg:text-7xl'
                    : 'text-4xl'
                }`}
              >
                :
              </motion.span>
              <span
                className={`font-semibold tracking-tighter text-white ${
                  isCompact
                    ? 'text-2xl sm:text-3xl'
                    : isShort || isNarrow
                    ? 'text-4xl'
                    : isLarge
                    ? 'text-6xl sm:text-7xl lg:text-8xl'
                    : 'text-5xl'
                }`}
              >
                {minutes}
              </span>

              {/* Seconds */}
              {showSeconds && !isCompact && (
                <span
                  className={`font-normal text-white/50 ml-1 tracking-normal ${
                    isShort || isNarrow ? 'text-sm' : isLarge ? 'text-2xl sm:text-3xl' : 'text-lg'
                  }`}
                >
                  .{seconds}
                </span>
              )}

              {/* AM/PM */}
              {!is24h && (
                <span
                  className={`font-semibold text-[#0A84FF] tracking-wider uppercase ml-1.5 ${
                    isCompact ? 'text-[9px]' : isLarge ? 'text-sm' : 'text-xs'
                  }`}
                >
                  {ampm}
                </span>
              )}
            </div>

            {/* Date Bar */}
            <div
              className={`flex items-center gap-1.5 text-white/70 transition-all flex-wrap justify-center ${
                isCompact ? 'mt-0.5 text-[10px]' : isLarge ? 'mt-2.5 text-sm sm:text-base' : 'mt-1 text-xs'
              }`}
            >
              <span className="font-medium text-white">
                {isLarge ? weekdayFull : weekdayShort}
              </span>
              <span className="text-white/30">•</span>
              <span>{monthDay}</span>
              {isLarge && (
                <>
                  <span className="text-white/30">•</span>
                  <span>{year}</span>
                </>
              )}
            </div>

            {/* Day Progress Indicator */}
            {!isShort && !isVeryShort && (
              <div className="w-32 sm:w-48 lg:w-64 mt-2 flex flex-col gap-1 items-center">
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0A84FF] rounded-full transition-all duration-1000"
                    style={{ width: `${dayProgress}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono text-white/40 tracking-wider uppercase">
                  {dayProgress}% of day
                </span>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: World Clock */}
        {activeTab === 'world' && (
          <div className="flex flex-col h-full w-full min-h-0 px-1 py-1 space-y-1.5">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-xs font-medium text-white/80">World Timezones</span>
              <button
                type="button"
                onClick={() => setShowAddCity(!showAddCity)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white transition-all no-drag"
              >
                <PlusIcon size={10} />
                <span>{showAddCity ? 'Cancel' : 'Add City'}</span>
              </button>
            </div>

            {/* Add City Form */}
            <AnimatePresence>
              {showAddCity && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleCreateCity}
                  className="p-2 rounded bg-black/40 border border-white/10 space-y-2 shrink-0 no-drag"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      placeholder="City Name..."
                      value={newCityName}
                      onChange={(e) => setNewCityName(e.target.value)}
                      className="px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-white no-drag"
                      required
                      autoFocus
                    />
                    <select
                      value={newCityTz}
                      onChange={(e) => {
                        setNewCityTz(e.target.value);
                        const preset = POPULAR_CITIES.find((p) => p.tz === e.target.value);
                        if (preset && !newCityName) setNewCityName(preset.city);
                      }}
                      className="px-2 py-1 text-xs bg-[#222] border border-white/10 rounded text-white no-drag"
                    >
                      {POPULAR_CITIES.map((c) => (
                        <option key={c.tz} value={c.tz}>
                          {c.city} ({c.tz})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-1">
                    <button
                      type="submit"
                      className="px-2.5 py-1 bg-[#0A84FF] rounded text-[11px] font-medium text-white hover:bg-[#0A84FF]/80 transition-all no-drag"
                    >
                      Save City
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* City List */}
            <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto pr-1">
              {worldClocks.length === 0 ? (
                <div className="text-[11px] text-white/40 text-center py-4">
                  No world clocks added. Click Add City to monitor other timezones.
                </div>
              ) : (
                worldClocks.map((clock) => {
                  let timeStr = '--:--';
                  let dateStr = '';
                  try {
                    timeStr = now.toLocaleTimeString('en-US', {
                      timeZone: clock.timezone,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: showSeconds ? '2-digit' : undefined,
                      hour12: !is24h,
                    });
                    dateStr = now.toLocaleDateString('en-US', {
                      timeZone: clock.timezone,
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    });
                  } catch {
                    timeStr = 'Invalid TZ';
                  }

                  return (
                    <div
                      key={clock.id}
                      className="flex items-center justify-between p-1.5 rounded bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-semibold text-white truncate">{clock.city_name}</div>
                        <div className="text-[10px] text-white/50 truncate">{dateStr} • {clock.timezone}</div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold tracking-tight font-tabular text-[#0A84FF]">
                          {timeStr}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeWorldClock(clock.id)}
                          className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/10 transition-all no-drag"
                          title="Remove city"
                        >
                          <TrashIcon size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: Alarms */}
        {activeTab === 'alarms' && (
          <div className="flex flex-col h-full w-full min-h-0 px-1 py-1 space-y-1.5">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-xs font-medium text-white/80">Desktop Alarms</span>
              <button
                type="button"
                onClick={() => setShowAddAlarm(!showAddAlarm)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white transition-all no-drag"
              >
                <PlusIcon size={10} />
                <span>{showAddAlarm ? 'Cancel' : 'New Alarm'}</span>
              </button>
            </div>

            {/* Add Alarm Form */}
            <AnimatePresence>
              {showAddAlarm && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleCreateAlarm}
                  className="p-2 rounded bg-black/40 border border-white/10 space-y-2 shrink-0 no-drag"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <input
                      type="time"
                      value={alarmTime}
                      onChange={(e) => setAlarmTime(e.target.value)}
                      className="px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-white no-drag"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Alarm label..."
                      value={alarmTitle}
                      onChange={(e) => setAlarmTitle(e.target.value)}
                      className="px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-white no-drag"
                      required
                    />
                  </div>

                  {/* Recurrence days */}
                  <div className="flex flex-wrap items-center justify-between gap-1 pt-1">
                    <label className="flex items-center gap-1.5 text-[10px] text-white/70 cursor-pointer no-drag">
                      <input
                        type="checkbox"
                        checked={alarmIsRecurring}
                        onChange={(e) => setAlarmIsRecurring(e.target.checked)}
                        className="rounded no-drag"
                      />
                      <span>Repeat Weekly</span>
                    </label>

                    {alarmIsRecurring && (
                      <div className="flex gap-1 flex-wrap">
                        {WEEKDAY_LABELS.map(({ day, label }) => {
                          const isSel = alarmDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleAlarmDay(day)}
                              className={`w-5 h-5 rounded text-[9px] font-mono flex items-center justify-center transition-all no-drag ${
                                isSel
                                  ? 'bg-[#0A84FF] text-white font-bold'
                                  : 'bg-white/10 text-white/50 hover:bg-white/20'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-1 pt-1">
                    <button
                      type="submit"
                      className="px-2.5 py-1 bg-[#0A84FF] rounded text-[11px] font-medium text-white hover:bg-[#0A84FF]/80 transition-all no-drag"
                    >
                      Save Alarm
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Alarms List */}
            <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto pr-1">
              {alarms.length === 0 ? (
                <div className="text-[11px] text-white/40 text-center py-4">
                  No alarms configured. Click New Alarm to set one.
                </div>
              ) : (
                alarms.map((alarm) => {
                  const daysText = alarm.is_recurring
                    ? alarm.days_of_week.length === 5 && !alarm.days_of_week.includes(6) && !alarm.days_of_week.includes(7)
                      ? 'Weekdays'
                      : alarm.days_of_week.length === 7
                      ? 'Every day'
                      : alarm.days_of_week
                          .map((d) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d - 1])
                          .join(', ')
                    : 'Once';

                  return (
                    <div
                      key={alarm.id}
                      className={`flex items-center justify-between p-1.5 rounded border transition-all ${
                        alarm.is_enabled
                          ? 'bg-white/[0.06] border-white/[0.1]'
                          : 'bg-white/[0.02] border-white/[0.04] opacity-50'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-base font-semibold tracking-tight font-tabular text-white">
                            {alarm.time_str}
                          </span>
                          <span className="text-xs text-white/80 truncate">{alarm.title}</span>
                        </div>
                        <div className="text-[9px] text-white/40 font-mono">{daysText}</div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Toggle On/Off switch */}
                        <button
                          type="button"
                          onClick={() => toggleAlarm(alarm.id)}
                          className={`w-8 h-4 rounded-full p-0.5 transition-colors no-drag ${
                            alarm.is_enabled ? 'bg-[#0A84FF]' : 'bg-white/20'
                          }`}
                          title={alarm.is_enabled ? 'Disable alarm' : 'Enable alarm'}
                        >
                          <div
                            className={`w-3 h-3 rounded-full bg-white transition-transform ${
                              alarm.is_enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteAlarm(alarm.id)}
                          className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/10 transition-all no-drag"
                          title="Delete alarm"
                        >
                          <TrashIcon size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ClockWidget: React.FC = () => {
  return (
    <GlassWidget>
      <ClockWidgetContent />
    </GlassWidget>
  );
};

export default ClockWidget;
