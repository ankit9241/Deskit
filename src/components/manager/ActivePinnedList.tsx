import React from 'react';
import { useWidgetStore } from '@/stores/widgetStore';
import { VisibilityMode } from '@/types/widget';
import { Trash2 } from 'lucide-react';

export const ActivePinnedList: React.FC = () => {
  const { widgets, unpinWidget, removeWidget, setVisibilityMode } = useWidgetStore();

  const pinnedWidgets = widgets.filter((w) => w.is_pinned);

  if (pinnedWidgets.length === 0) {
    return (
      <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
        <p className="text-xs text-slate-500 font-medium">
          No active floating widgets on your desktop. Pin one from the library above!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pinnedWidgets.map((widget) => {
        return (
          <div
            key={widget.id}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700/60 transition-all text-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <div>
                <span className="font-semibold text-slate-200">{widget.title}</span>
                <span className="text-[10px] text-slate-500 font-mono ml-2">
                  pos: ({Math.round(widget.x)}, {Math.round(widget.y)}) • size: {Math.round(widget.width)}×{Math.round(widget.height)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={widget.visibility_mode}
                onChange={(e) => setVisibilityMode(widget.id, e.target.value as VisibilityMode)}
                className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-300 focus:outline-none"
              >
                <option value="always_on_top">Always On Top (Win32 HWND_TOPMOST)</option>
                <option value="smart">Smart / Standard (Non-Topmost)</option>
                <option value="desktop_only" disabled>
                  Desktop Only (Unsupported in Phase 1)
                </option>
              </select>

              <button
                onClick={() => unpinWidget(widget.id)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
                title="Close floating window"
              >
                Unpin
              </button>

              <button
                onClick={() => removeWidget(widget.id)}
                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                title="Remove widget"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
