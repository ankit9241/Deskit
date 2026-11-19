import React, { useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from 'framer-motion';
import {
  DeskitLogo,
  ClockIcon,
  TasksIcon,
  FocusIcon,
  NotesIcon,
  PlusIcon,
} from '@/components/shared/icons';
import { useWidgetStore } from '@/stores/widgetStore';
import { WidgetType } from '@/types/widget';

interface DockItemProps {
  mouseX: any;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}

const DockItem: React.FC<DockItemProps> = ({ mouseX, icon, label, onClick, isActive }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthSync = useTransform(distance, [-100, 0, 100], [34, 46, 34]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 220, damping: 16 });

  return (
    <div className="relative flex flex-col items-center">
      {/* Tooltip */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: -6, scale: 1 }}
            exit={{ opacity: 0, y: 3, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute -top-7 px-2 py-0.5 rounded-md bg-[#1C1B18]/95 backdrop-blur-md border border-white/[0.08] text-[10px] font-medium text-[#F1EFE8] whitespace-nowrap shadow-lg pointer-events-none z-50 font-mono"
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        ref={ref}
        style={{ width, height: width }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
        whileTap={{ scale: 0.92 }}
        className={`relative flex items-center justify-center rounded-xl cursor-pointer transition-colors ${
          isActive
            ? 'bg-[#C5B89D]/20 text-[#C5B89D] border border-[#C5B89D]/40'
            : 'bg-white/[0.04] hover:bg-white/[0.09] text-[#B7B3A9] hover:text-[#F1EFE8] border border-white/[0.06]'
        }`}
      >
        {icon}
        {isActive && (
          <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#C5B89D]" />
        )}
      </motion.div>
    </div>
  );
};

interface FloatingDockProps {
  onOpenLibrary?: () => void;
  onOpenManager?: () => void;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({
  onOpenLibrary,
  onOpenManager,
}) => {
  const mouseX = useMotionValue(Infinity);
  const { widgets, pinWidget } = useWidgetStore();

  const isPinned = (type: WidgetType) =>
    widgets.some((w) => w.widget_type === type && w.is_pinned);

  const handleToggleWidget = async (type: WidgetType, title: string) => {
    await pinWidget(type, title);
  };

  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className="flex items-end gap-1.5 px-2.5 py-1.5 rounded-full bg-[#242421]/90 backdrop-blur-2xl border border-white/[0.08] shadow-capsule z-40"
    >
      {/* DESKIT Manager Toggle */}
      <DockItem
        mouseX={mouseX}
        icon={<DeskitLogo size={16} />}
        label="DESKIT Manager"
        onClick={() => onOpenManager && onOpenManager()}
      />

      <div className="w-[1px] h-5 bg-white/[0.08] mx-0.5 self-center" />

      {/* Clock */}
      <DockItem
        mouseX={mouseX}
        icon={<ClockIcon size={16} />}
        label="Clock"
        onClick={() => handleToggleWidget('clock', 'Clock')}
        isActive={isPinned('clock')}
      />

      {/* Tasks */}
      <DockItem
        mouseX={mouseX}
        icon={<TasksIcon size={16} />}
        label="Tasks"
        onClick={() => handleToggleWidget('tasks', 'Tasks')}
        isActive={isPinned('tasks')}
      />

      {/* Focus Timer */}
      <DockItem
        mouseX={mouseX}
        icon={<FocusIcon size={16} />}
        label="Focus Timer"
        onClick={() => handleToggleWidget('focus', 'Focus Timer')}
        isActive={isPinned('focus')}
      />

      {/* Quick Notes */}
      <DockItem
        mouseX={mouseX}
        icon={<NotesIcon size={16} />}
        label="Quick Notes"
        onClick={() => handleToggleWidget('notes', 'Quick Notes')}
        isActive={isPinned('notes')}
      />

      <div className="w-[1px] h-5 bg-white/[0.08] mx-0.5 self-center" />

      {/* Add Widget / Library */}
      <DockItem
        mouseX={mouseX}
        icon={<PlusIcon size={15} />}
        label="Add Widget"
        onClick={() => onOpenLibrary && onOpenLibrary()}
      />
    </motion.div>
  );
};
