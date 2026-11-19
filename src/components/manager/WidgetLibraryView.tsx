import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useWidgetStore } from '@/stores/widgetStore';
import { WidgetType } from '@/types/widget';
import { isTauri } from '@/services/tauriApi';
import {
  PinIcon,
  CheckIcon,
} from '@/components/shared/icons';

interface WidgetDef {
  type: WidgetType;
  title: string;
  renderHeroPreview: () => React.ReactNode;
}

export const WidgetLibraryView: React.FC = () => {
  const { widgets, pinWidget } = useWidgetStore();
  const [pinningType, setPinningType] = useState<WidgetType | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handlePin = async (def: WidgetDef) => {
    setPinningType(def.type);
    setFeedbackMessage(null);

    try {
      const res = await pinWidget(def.type, def.title);

      if (res) {
        if (isTauri()) {
          setFeedbackMessage({ text: `Pinned ${def.title} to Windows desktop.`, isError: false });
        } else {
          setFeedbackMessage({
            text: `Pinned ${def.title} preview popup opened.`,
            isError: false,
          });
        }
      } else {
        const storeError = useWidgetStore.getState().error;
        setFeedbackMessage({
          text: storeError ? `Failed to spawn ${def.title}: ${storeError}` : `Failed to spawn ${def.title} window.`,
          isError: true,
        });
      }
    } catch (err) {
      setFeedbackMessage({ text: `Error: ${String(err)}`, isError: true });
    } finally {
      setPinningType(null);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  const getPinnedCount = (type: WidgetType) =>
    widgets.filter((w) => w.widget_type === type && w.is_pinned).length;

  const libraryDefs: WidgetDef[] = [
    {
      type: 'clock',
      title: 'Clock',
      renderHeroPreview: () => (
        <div className="flex flex-col items-center justify-center h-28 w-full rounded-widget bg-[#242421]/80 border border-white/[0.08] text-[#F1EFE8]">
          <div className="flex items-baseline gap-1 font-tabular">
            <span className="text-3xl font-light">09</span>
            <span className="text-[#C5B89D] text-2xl">:</span>
            <span className="text-3xl font-light">41</span>
            <span className="text-xs text-[#858178] ml-1">.28</span>
            <span className="text-[10px] text-[#C5B89D] font-mono ml-1">AM</span>
          </div>
          <span className="text-[11px] text-[#B7B3A9] mt-1 font-medium">Wed • Oct 28</span>
        </div>
      ),
    },
    {
      type: 'tasks',
      title: 'Tasks',
      renderHeroPreview: () => (
        <div className="flex flex-col justify-center gap-1.5 h-28 w-full p-3 rounded-widget bg-[#242421]/80 border border-white/[0.08] text-[#F1EFE8]">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full border border-[#C5B89D]" />
            <span className="text-xs text-[#F1EFE8] truncate">Ship design specification</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#C58D85] ml-auto shrink-0" />
          </div>
          <div className="flex items-center gap-2 opacity-50">
            <div className="w-3.5 h-3.5 rounded-full bg-[#9DAE9B] flex items-center justify-center text-[#242421]">
              <CheckIcon size={9} strokeWidth={2.5} />
            </div>
            <span className="text-xs line-through text-[#858178] truncate">Review pull request</span>
          </div>
        </div>
      ),
    },
    {
      type: 'focus',
      title: 'Focus Timer',
      renderHeroPreview: () => (
        <div className="flex items-center justify-center gap-3.5 h-28 w-full p-3 rounded-widget bg-[#242421]/80 border border-white/[0.08] text-[#F1EFE8]">
          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            <svg width="48" height="48" className="transform -rotate-90">
              <circle cx="24" cy="24" r="20" stroke="rgba(241,239,232,0.08)" strokeWidth="3" fill="none" />
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="#C5B89D"
                strokeWidth="3"
                strokeDasharray="125"
                strokeDashoffset="35"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <span className="absolute font-tabular text-[10px] font-medium text-[#F1EFE8]">21m</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-[#F1EFE8]">Focus Session</span>
            <span className="text-[10px] text-[#858178]">25:00 • Deep Work</span>
          </div>
        </div>
      ),
    },
    {
      type: 'notes',
      title: 'Quick Notes',
      renderHeroPreview: () => (
        <div className="flex flex-col justify-between h-28 w-full p-3 rounded-widget bg-[#242421]/80 border border-white/[0.08] text-[#F1EFE8]">
          <div className="flex items-center justify-between text-[10px] text-[#858178]">
            <span className="font-medium text-[#F1EFE8]">Architecture Ideas</span>
            <span className="text-[#9DAE9B]">• Saved</span>
          </div>
          <p className="text-xs text-[#B7B3A9] line-clamp-2 leading-relaxed">
            Dynamic Island capsule with native Win32 window resizing...
          </p>
        </div>
      ),
    },
    {
      type: 'deadlines',
      title: 'Deadlines',
      renderHeroPreview: () => (
        <div className="flex flex-col justify-center gap-1.5 h-28 w-full p-3 rounded-widget bg-[#242421]/80 border border-white/[0.08] text-[#F1EFE8]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#F1EFE8] font-medium truncate">Beta Release</span>
            <span className="text-[#C9A77D] font-mono text-[10px]">in 2 days</span>
          </div>
          <div className="flex items-center justify-between text-xs opacity-70">
            <span className="text-[#B7B3A9] truncate">Sprint Review</span>
            <span className="text-[#858178] font-mono text-[10px]">in 5 days</span>
          </div>
        </div>
      ),
    },
    {
      type: 'goals',
      title: 'Daily Goals',
      renderHeroPreview: () => (
        <div className="flex flex-col justify-center gap-2.5 h-28 w-full p-3 rounded-widget bg-[#242421]/80 border border-white/[0.08] text-[#F1EFE8]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#F1EFE8] font-medium truncate">Read 20 pages</span>
            <span className="text-[#9DAE9B] font-mono font-medium">15/20</span>
          </div>
          <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-[#9DAE9B] rounded-full w-3/4" />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[#F1EFE8]">Widget Library</h2>
          <p className="text-xs text-[#858178]">
            Click Pin to spawn an independent native desktop window that automatically collapses into a capsule.
          </p>
        </div>

        {feedbackMessage && (
          <span
            className={`text-xs px-2.5 py-1 rounded-control font-medium ${
              feedbackMessage.isError ? 'bg-[#C58D85]/20 text-[#C58D85]' : 'bg-[#9DAE9B]/20 text-[#9DAE9B]'
            }`}
          >
            {feedbackMessage.text}
          </span>
        )}
      </div>

      {/* Grid of Distinctive Widget Compositions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {libraryDefs.map((def) => {
          const pinnedCount = getPinnedCount(def.type);
          const isPinning = pinningType === def.type;

          return (
            <motion.div
              key={def.type}
              whileHover={{ y: -1 }}
              transition={{ duration: 0.15 }}
              className="p-3.5 rounded-manager manager-card flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-[#F1EFE8]">{def.title}</span>
                  {pinnedCount > 0 && (
                    <span className="text-[10px] text-[#C5B89D] font-mono">
                      {pinnedCount} active
                    </span>
                  )}
                </div>

                {/* Hero Widget Preview */}
                <div className="my-1.5">{def.renderHeroPreview()}</div>
              </div>

              {/* Discreet Pin Action */}
              <div className="pt-3 flex items-center justify-between">
                <span className="text-[10px] text-[#858178]">Dynamic Island morph</span>
                <button
                  onClick={() => handlePin(def)}
                  disabled={isPinning}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-control btn-accent text-xs font-medium"
                >
                  <PinIcon size={11} filled />
                  <span>{isPinning ? 'Pinning...' : 'Pin to Desktop'}</span>
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
