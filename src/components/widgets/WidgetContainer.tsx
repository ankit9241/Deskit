import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  PinIcon,
  CloseIcon,
  CollapseIcon,
  LockIcon,
  UnlockIcon,
  GripIcon,
} from '@/components/shared/icons';
import * as api from '@/services/tauriApi';
import { useWidgetStore } from '@/stores/widgetStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { VisibilityMode, WidgetType } from '@/types/widget';
import { useWidgetDimensions } from '@/hooks/useWidgetDimensions';
import { useDynamicIsland } from '@/hooks/useDynamicIsland';
import { WidgetCapsule } from './WidgetCapsule';

interface WidgetContainerProps {
  widgetId: string;
  widgetType: WidgetType;
  title: string;
  children: React.ReactNode;
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  widgetId,
  widgetType,
  title,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useWidgetDimensions(containerRef);
  const { widgets, setVisibilityMode, unpinWidget } = useWidgetStore();
  const { lockPosition, setLockPosition, reducedMotion } = useAppearanceStore();

  const currentWidget = widgets.find((w) => w.id === widgetId);
  const isTopmost = currentWidget?.visibility_mode === 'always_on_top';
  const [localTopmost, setLocalTopmost] = useState(isTopmost ?? true);
  const [isHovered, setIsHovered] = useState(false);

  // Dynamic Island Engine
  const defaultW = currentWidget?.width || 280;
  const defaultH = currentWidget?.height || 180;
  const {
    isCollapsed,
    collapse,
    expand,
    updateExpandedDimensions,
    setIsInteracting,
  } = useDynamicIsland({
    widgetId,
    widgetType,
    defaultExpandedWidth: defaultW,
    defaultExpandedHeight: defaultH,
  });

  // Track resizing while expanded
  useEffect(() => {
    if (!isCollapsed && dimensions.width > 120 && dimensions.height > 40) {
      updateExpandedDimensions(dimensions.width, dimensions.height);
    }
  }, [dimensions.width, dimensions.height, isCollapsed, updateExpandedDimensions]);

  const handleToggleTopmost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMode: VisibilityMode = localTopmost ? 'smart' : 'always_on_top';
    setLocalTopmost(!localTopmost);
    await api.setNativeTopmost(!localTopmost);
    if (widgetId) {
      await setVisibilityMode(widgetId, nextMode);
    }
  };

  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLockPosition(!lockPosition);
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (widgetId) {
      await unpinWidget(widgetId);
    } else {
      await api.closeWindow();
    }
  };

  const transitionConfig = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, damping: 28, stiffness: 380, mass: 0.8 };

  // ---------------- PRESENTATION STATE: DYNAMIC ISLAND CAPSULE ----------------
  if (isCollapsed) {
    return (
      <div className={`w-screen h-screen flex items-center justify-center p-0.5 ${api.isTauri() ? 'bg-transparent' : 'bg-[#1C1B18]'} overflow-hidden`}>
        <WidgetCapsule widgetType={widgetType} onExpand={expand} />
      </div>
    );
  }

  // ---------------- PRESENTATION STATE: EXPANDED WIDGET ----------------
  return (
    <div
      ref={containerRef}
      onMouseEnter={() => {
        setIsHovered(true);
        setIsInteracting(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsInteracting(false);
      }}
      className={`relative flex flex-col h-screen w-screen bg-[#242421] ${
        api.isTauri() ? 'glass-widget' : 'border border-white/[0.08]'
      } overflow-hidden select-none text-[#F1EFE8] group transition-shadow duration-300`}
      data-tauri-drag-region={!lockPosition ? '' : undefined}
    >
      {/* Web Preview Banner in browser mode */}
      {!api.isTauri() && (
        <div className="bg-[#C5B89D]/15 border-b border-[#C5B89D]/20 px-2 py-0.5 text-[9px] text-[#C5B89D] flex items-center justify-between shrink-0 z-40">
          <span>Browser Preview</span>
          <span className="text-[#858178]">Launch pinned.exe for Native Always-on-Top</span>
        </div>
      )}
      {/* Contextual Floating Header Pill - Revealed on hover */}
      <div
        data-tauri-drag-region={!lockPosition ? '' : undefined}
        className="absolute top-1.5 inset-x-2 z-50 flex items-center justify-between pointer-events-none px-1"
      >
        {/* Title & Drag Grip */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: isHovered ? 1 : 0.2, y: 0 }}
          transition={transitionConfig}
          data-tauri-drag-region={!lockPosition ? '' : undefined}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#242421]/60 backdrop-blur-md border border-[#F1EFE8]/[0.08] pointer-events-auto cursor-move"
          title={lockPosition ? 'Window position locked' : 'Drag to reposition'}
        >
          {!lockPosition && <GripIcon size={11} className="text-[#B7B3A9] shrink-0" />}
          <span className="text-[11px] font-medium tracking-tight text-[#F1EFE8] truncate max-w-[120px]">
            {title}
          </span>
        </motion.div>

        {/* Action Controls */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{
            opacity: isHovered ? 1 : 0,
            scale: isHovered ? 1 : 0.95,
          }}
          transition={transitionConfig}
          className="flex items-center gap-1 p-0.5 rounded-full bg-[#242421]/60 backdrop-blur-md border border-[#F1EFE8]/[0.08] pointer-events-auto"
        >
          {/* Lock Position Toggle */}
          <button
            onClick={handleToggleLock}
            className={`p-1 rounded-full transition-colors ${
              lockPosition
                ? 'text-[#C9A77D] bg-[#C9A77D]/15 hover:bg-[#C9A77D]/25'
                : 'text-[#B7B3A9] hover:text-[#F1EFE8] hover:bg-white/10'
            }`}
            title={lockPosition ? 'Position locked' : 'Lock position'}
          >
            {lockPosition ? <LockIcon size={11} /> : <UnlockIcon size={11} />}
          </button>

          {/* Always on top Pin */}
          <button
            onClick={handleToggleTopmost}
            className={`p-1 rounded-full transition-colors ${
              localTopmost
                ? 'text-[#C5B89D] bg-[#C5B89D]/20 hover:bg-[#C5B89D]/30'
                : 'text-[#B7B3A9] hover:text-[#F1EFE8] hover:bg-white/10'
            }`}
            title={localTopmost ? 'Always on Top (Active)' : 'Always on Top (Inactive)'}
          >
            <PinIcon size={11} filled={localTopmost} />
          </button>

          {/* Morph to Capsule (Collapse) */}
          <button
            onClick={() => collapse()}
            className="p-1 rounded-full text-[#B7B3A9] hover:text-[#F1EFE8] hover:bg-white/10 transition-colors"
            title="Collapse into Dynamic Island capsule"
          >
            <CollapseIcon size={11} />
          </button>

          {/* Close / Unpin */}
          <button
            onClick={handleClose}
            className="p-1 rounded-full text-[#B7B3A9] hover:text-[#C58D85] hover:bg-[#C58D85]/15 transition-colors"
            title="Unpin / Close"
          >
            <CloseIcon size={11} />
          </button>
        </motion.div>
      </div>

      {/* Main Interactive Content */}
      <div
        className={`flex-1 w-full overflow-hidden flex flex-col ${
          dimensions.isXs ? 'pt-6 p-2' : 'pt-7 p-3'
        }`}
      >
        {children}
      </div>
    </div>
  );
};
