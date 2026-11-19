import React from 'react';
import { WidgetMetadata } from '@/types/widget';
import { useWidgetStore } from '@/stores/widgetStore';
import { Clock, CheckSquare, Timer, FileText, Calendar, Target, Pin, X } from 'lucide-react';

interface WidgetCardProps {
  metadata: WidgetMetadata;
}

export const WidgetCard: React.FC<WidgetCardProps> = ({ metadata }) => {
  const { widgets, pinWidget, unpinWidget } = useWidgetStore();

  const pinnedInstance = widgets.find(
    (w) => w.widget_type === metadata.type && w.is_pinned
  );

  const isPinned = !!pinnedInstance;

  const getIcon = () => {
    switch (metadata.type) {
      case 'clock':
        return <Clock size={20} className="text-sky-400" />;
      case 'tasks':
        return <CheckSquare size={20} className="text-emerald-400" />;
      case 'focus':
        return <Timer size={20} className="text-amber-400" />;
      case 'notes':
        return <FileText size={20} className="text-indigo-400" />;
      case 'deadlines':
        return <Calendar size={20} className="text-rose-400" />;
      case 'goals':
        return <Target size={20} className="text-teal-400" />;
    }
  };

  const handlePinToggle = () => {
    if (isPinned && pinnedInstance) {
      unpinWidget(pinnedInstance.id);
    } else {
      pinWidget(metadata.type);
    }
  };

  return (
    <div className="flex flex-col justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 transition-all shadow-sm group">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/50">
            {getIcon()}
          </div>
          {isPinned ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              PINNED
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/50">
              READY
            </span>
          )}
        </div>

        <h3 className="text-sm font-semibold text-slate-100 mb-1">{metadata.name}</h3>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{metadata.description}</p>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-500 font-mono">
          {metadata.defaultWidth} × {metadata.defaultHeight}px
        </span>

        <button
          onClick={handlePinToggle}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            isPinned
              ? 'bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700/60'
              : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm shadow-sky-600/20'
          }`}
        >
          {isPinned ? (
            <>
              <X size={13} />
              Unpin
            </>
          ) : (
            <>
              <Pin size={13} />
              Pin Widget
            </>
          )}
        </button>
      </div>
    </div>
  );
};
