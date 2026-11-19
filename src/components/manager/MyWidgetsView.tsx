import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWidgetStore } from '@/stores/widgetStore';
import { WidgetInstance, VisibilityMode } from '@/types/widget';
import * as api from '@/services/tauriApi';
import {
  PinIcon,
  CollapseIcon,
  ExpandIcon,
  TrashIcon,
  ClockIcon,
  TasksIcon,
  FocusIcon,
  NotesIcon,
  DeadlinesIcon,
  GoalsIcon,
  ChevronRightIcon,
} from '@/components/shared/icons';

interface MyWidgetsViewProps {
  onGoToLibrary: () => void;
}

export const MyWidgetsView: React.FC<MyWidgetsViewProps> = ({ onGoToLibrary }) => {
  const { widgets, unpinWidget, removeWidget, setVisibilityMode, toggleCollapse } = useWidgetStore();

  const getWidgetIcon = (type: string) => {
    switch (type) {
      case 'clock':
        return <ClockIcon size={15} className="text-[#C5B89D]" />;
      case 'tasks':
        return <TasksIcon size={15} className="text-[#C5B89D]" />;
      case 'focus':
        return <FocusIcon size={15} className="text-[#C5B89D]" />;
      case 'notes':
        return <NotesIcon size={15} className="text-[#C5B89D]" />;
      case 'deadlines':
        return <DeadlinesIcon size={15} className="text-[#C5B89D]" />;
      case 'goals':
        return <GoalsIcon size={15} className="text-[#9DAE9B]" />;
      default:
        return <ClockIcon size={15} />;
    }
  };

  const handleOpenWindow = async (widget: WidgetInstance) => {
    await api.pinWidget(widget.widget_type, widget.title);
  };

  const handleToggleVisibilityMode = async (widget: WidgetInstance) => {
    const nextMode: VisibilityMode =
      widget.visibility_mode === 'always_on_top' ? 'smart' : 'always_on_top';
    await setVisibilityMode(widget.id, nextMode);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[#F1EFE8]">
            Active Desktop Widgets
          </h2>
          <p className="text-xs text-[#858178]">
            Manage independent native windows, visibility states, and capsule presentation.
          </p>
        </div>

        <button
          onClick={onGoToLibrary}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-control btn-accent text-xs"
        >
          <span>Add Widget</span>
          <ChevronRightIcon size={13} />
        </button>
      </div>

      {/* Widgets List */}
      {widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 rounded-manager border border-dashed border-white/[0.08] bg-[#302F2B]/30 text-center">
          <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center text-[#858178] mb-3">
            <ClockIcon size={20} />
          </div>
          <h3 className="text-sm font-medium text-[#F1EFE8] mb-1">No Active Widgets</h3>
          <p className="text-xs text-[#858178] max-w-sm mb-4 leading-relaxed">
            Widgets float directly over your desktop applications and automatically morph into compact Dynamic Island capsules.
          </p>
          <button
            onClick={onGoToLibrary}
            className="px-3.5 py-1.5 rounded-control btn-accent text-xs"
          >
            Open Widget Library
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence>
            {widgets.map((widget) => {
              const isTopmost = widget.visibility_mode === 'always_on_top';

              return (
                <motion.div
                  key={widget.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="p-3.5 rounded-manager manager-card flex flex-col justify-between"
                >
                  {/* Top: Identity & Mode */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded bg-white/[0.04]">
                        {getWidgetIcon(widget.widget_type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-[#F1EFE8] leading-none">
                            {widget.title}
                          </h4>
                          <span className="text-[10px] text-[#858178] font-mono">
                            {widget.is_collapsed ? 'Capsule' : 'Expanded'}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#858178] font-mono">
                          ID: {widget.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>

                    {/* Always on top pill */}
                    <button
                      onClick={() => handleToggleVisibilityMode(widget)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                        isTopmost
                          ? 'bg-[#C5B89D]/20 text-[#C5B89D] border border-[#C5B89D]/30'
                          : 'bg-white/[0.04] text-[#858178] border border-white/[0.06] hover:text-[#F1EFE8]'
                      }`}
                      title="Toggle Always on Top"
                    >
                      <PinIcon size={10} filled={isTopmost} />
                      <span>{isTopmost ? 'Topmost' : 'Standard'}</span>
                    </button>
                  </div>

                  {/* Coordinates & Size */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#858178] bg-[#242421]/60 px-2.5 py-1.5 rounded-control mb-3">
                    <span>Position: X {Math.round(widget.x)}, Y {Math.round(widget.y)}</span>
                    <span>Size: {Math.round(widget.width)} × {Math.round(widget.height)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenWindow(widget)}
                        className="px-2.5 py-1 rounded-control btn-quiet text-[11px] font-medium"
                      >
                        Bring to Front
                      </button>

                      <button
                        onClick={() => toggleCollapse(widget.id)}
                        className="px-2.5 py-1 rounded-control btn-quiet text-[11px] font-medium flex items-center gap-1"
                      >
                        {widget.is_collapsed ? <ExpandIcon size={11} /> : <CollapseIcon size={11} />}
                        <span>{widget.is_collapsed ? 'Expand' : 'Collapse'}</span>
                      </button>

                      <button
                        onClick={() => unpinWidget(widget.id)}
                        className="px-2.5 py-1 rounded-control btn-quiet text-[11px] font-medium text-[#858178] hover:text-[#F1EFE8]"
                      >
                        Unpin
                      </button>
                    </div>

                    <button
                      onClick={() => removeWidget(widget.id)}
                      className="p-1 rounded-control btn-quiet text-[#858178] hover:text-[#C58D85]"
                      title="Delete instance"
                    >
                      <TrashIcon size={12} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
