import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LockIcon,
  UnlockIcon,
  GripIcon,
} from '@/components/shared/icons';
import * as api from '@/services/tauriApi';
import { useWidgetStore } from '@/stores/widgetStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { VisibilityMode, WidgetType } from '@/types/widget';
import { useWidgetDimensions } from '@/hooks/useWidgetDimensions';
import { useDynamicIsland, getCapsuleDimensions } from '@/hooks/useDynamicIsland';
import { WidgetCapsule } from './WidgetCapsule';
import { cn } from '@/lib/utils';
import { NATIVE_BLUR, NATIVE_CORNER_RADIUS, DISABLE_ACRYLIC_DURING_DRAG } from '@/config/glass';
import './GlassWidget.css';

interface WidgetContainerProps {
  widgetId: string;
  widgetType: WidgetType;
  title: string;
  children: React.ReactNode;
  /**
   * Corner radius in pixels: 24 to 28 (default: 28)
   */
  radius?: number;
  /**
   * Backdrop blur in pixels (default: 20).
   * Tuning:
   * - Objects behind still too sharp: raise blur to 24 to 28.
   * - Behind content too hard to see: lower blur to 16.
   */
  blur?: number;
  /**
   * Backdrop saturation percentage (default: 130)
   */
  saturate?: number | string;
  /**
   * Glass dark tint opacity: 0.18 to 0.45 (default: 0.28).
   * Tuning:
   * - Behind content too hard to see: lower tint to 0.18 to 0.22.
   * - Too see-through for readability: raise tint to 0.35 to 0.40.
   * - Never go above 0.45 (it turns into a solid dark box).
   */
  tint?: number;
  /**
   * Border alpha opacity of white (default: 0.14)
   */
  borderOpacity?: number;
  /** Legacy alias for tint */
  opacity?: number;
  /** Idle delay before auto-collapse in ms (default: 3000) */
  idleDelay?: number;
  /** Collapse / expand morph duration in ms (default: 650) */
  duration?: number;
  collapsedSize?: { width: number; height: number };
  expandedSize?: { width: number; height: number };
  collapsedRadius?: number;
  expandedRadius?: number;
}

const DEFAULT_DURATION = 650;
const DEFAULT_IDLE_DELAY = 3000;
const DEFAULT_EXPANDED_SIZE = { width: 300, height: 150 };
const DEFAULT_EXPANDED_RADIUS = 14;

const getWidgetMinDimensions = (type: WidgetType): { width: number; height: number } => {
  switch (type) {
    case 'clock':
      return { width: 200, height: 100 };
    case 'tasks':
      return { width: 260, height: 220 };
    case 'focus':
      return { width: 220, height: 160 };
    case 'notes':
      return { width: 240, height: 180 };
    case 'deadlines':
      return { width: 240, height: 200 };
    case 'goals':
      return { width: 240, height: 200 };
    default:
      return { width: 200, height: 100 };
  }
};

const MAX_WIDGET_SIZE = { width: 1600, height: 1200 };

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  widgetId,
  widgetType,
  title,
  children,
  radius = DEFAULT_EXPANDED_RADIUS,
  blur = 20,
  saturate = 130,
  tint = 0.28,
  borderOpacity = 0.14,
  opacity,
  idleDelay: idleDelayProp,
  duration: durationProp = DEFAULT_DURATION,
  expandedSize: expandedSizeProp = DEFAULT_EXPANDED_SIZE,
}) => {
  const dimensions = useWidgetDimensions();
  const { widgets, setVisibilityMode, unpinWidget } = useWidgetStore();
  const {
    autoCollapse,
    collapseDelaySeconds,
    lockPosition,
    setLockPosition,
    reducedMotion,
  } = useAppearanceStore();

  const currentWidget = widgets.find((w) => w.id === widgetId);
  const isTopmost = currentWidget?.visibility_mode === 'always_on_top';
  const [localTopmost, setLocalTopmost] = useState(isTopmost ?? true);
  const [trafficHovered, setTrafficHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const effectiveTint = opacity !== undefined ? opacity : tint;
  const saturateVal = typeof saturate === 'number' ? `${saturate}%` : saturate;

  useEffect(() => {
    if (currentWidget) {
      setLocalTopmost(currentWidget.visibility_mode === 'always_on_top');
    }
  }, [currentWidget?.visibility_mode]);

  const expandedSize =
    expandedSizeProp ??
    (currentWidget
      ? {
        width: Math.max(160, currentWidget.width),
        height: Math.max(80, currentWidget.height),
      }
      : DEFAULT_EXPANDED_SIZE);

  const idleDelayMs =
    idleDelayProp ?? (autoCollapse !== false ? collapseDelaySeconds * 1000 : DEFAULT_IDLE_DELAY);

  const capsuleDims = getCapsuleDimensions(widgetType);
  const capsuleW = capsuleDims.width;
  const capsuleH = capsuleDims.height;

  // Track expanded dimensions accurately so collapse and expand can coordinate window sizes
  const lastExpandedSizeRef = useRef({
    width: Math.max(160, dimensions.width || expandedSize.width),
    height: Math.max(80, dimensions.height || expandedSize.height),
  });

  // Dynamic Island state machine with manualWindowResize so WidgetContainer coordinates window timing
  const {
    collapsed,
    collapse,
    expand,
    updateExpandedDimensions,
    setIsInteracting,
  } = useDynamicIsland({
    widgetId,
    widgetType,
    defaultExpandedWidth: expandedSize.width,
    defaultExpandedHeight: expandedSize.height,
    initialCollapsed: currentWidget?.is_collapsed ?? false,
    idleDelayMs,
    durationMs: durationProp,
    manualWindowResize: true,
  });

  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && dimensions.width > 120 && dimensions.height > 40) {
      lastExpandedSizeRef.current = {
        width: dimensions.width,
        height: dimensions.height,
      };
      updateExpandedDimensions(dimensions.width, dimensions.height);
    }
  }, [dimensions.width, dimensions.height, collapsed, updateExpandedDimensions]);

  // Fix 3: Handle native window sizing after collapse animation completes
  const handleAnimationComplete = async () => {
    if (collapsed) {
      const expW = lastExpandedSizeRef.current.width;
      const shiftX = Math.round((expW - capsuleW) / 2);

      if (api.isTauri()) {
        try {
          const [winX, winY] = await api.getWindowPosition();
          await api.setWindowPosition(winX + shiftX, winY);
          await api.setWindowSize(capsuleW, capsuleH);
        } catch (err) {
          console.error('[WidgetContainer] Error sizing window on collapse:', err);
        }
      }
      if (widgetId) {
        api.toggleCollapseWidget(widgetId, true).catch(() => { });
      }
    }
  };

  // Fix 3: First size and shift the window back, then trigger expansion animation
  const handleExpand = async () => {
    const expW = lastExpandedSizeRef.current.width;
    const expH = lastExpandedSizeRef.current.height;
    const shiftX = Math.round((expW - capsuleW) / 2);

    if (api.isTauri()) {
      try {
        const [winX, winY] = await api.getWindowPosition();
        await api.setWindowPosition(winX - shiftX, winY);
        await api.setWindowSize(expW, expH);
      } catch (err) {
        console.error('[WidgetContainer] Error sizing window on expand:', err);
      }
    }

    expand();
    if (widgetId) {
      api.toggleCollapseWidget(widgetId, false).catch(() => { });
    }
  };

  // Mac Wireframe Dragging: shows white outline border while dragging instead of moving the whole widget.
  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (lockPosition) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        'button, input, textarea, select, a, [role="button"], .no-drag, .resize-handle'
      )
    ) {
      return;
    }

    const startX = e.screenX;
    const startY = e.screenY;
    let dragInitiated = false;

    setIsDragging(true);
    setIsInteracting(true);

    const onMouseMove = (moveEvt: MouseEvent) => {
      const dist = Math.hypot(moveEvt.screenX - startX, moveEvt.screenY - startY);
      if (dist > 3 && !dragInitiated) {
        dragInitiated = true;

        if (DISABLE_ACRYLIC_DURING_DRAG) {
          api.clearWindowAcrylic().catch(() => {});
        }

        requestAnimationFrame(() => {
          setTimeout(async () => {
            try {
              if (api.isTauri()) {
                await api.startDragging();
              }
            } finally {
              setIsDragging(false);
              setIsInteracting(false);
              if (DISABLE_ACRYLIC_DURING_DRAG) {
                api.applyWindowAcrylic().catch(() => {});
              }
            }
          }, 16);
        });

        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDragging(false);
      setIsInteracting(false);
      if (dragInitiated && DISABLE_ACRYLIC_DURING_DRAG) {
        api.applyWindowAcrylic().catch(() => {});
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Interactive Multi-Directional Resize Handler (e, s, w, n, se, sw, ne, nw)
  const handleResizeStart = (
    e: React.MouseEvent,
    direction: 'e' | 's' | 'w' | 'n' | 'se' | 'sw' | 'ne' | 'nw'
  ) => {
    if (lockPosition || collapsed) return;
    e.preventDefault();
    e.stopPropagation();
    setIsInteracting(true);

    if (DISABLE_ACRYLIC_DURING_DRAG) {
      api.clearWindowAcrylic().catch(() => {});
    }

    const startX = e.screenX;
    const startY = e.screenY;
    const startW = dimensions.width || window.innerWidth;
    const startH = dimensions.height || window.innerHeight;
    const minDims = getWidgetMinDimensions(widgetType);

    let startWinX = window.screenX;
    let startWinY = window.screenY;

    if (api.isTauri() && (direction.includes('w') || direction.includes('n'))) {
      api.getWindowPosition().then(([x, y]) => {
        startWinX = x;
        startWinY = y;
      });
    }

    let rafId: number | null = null;

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (rafId !== null) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        const deltaX = moveEvt.screenX - startX;
        const deltaY = moveEvt.screenY - startY;

        let newW = startW;
        let newH = startH;
        let newX = startWinX;
        let newY = startWinY;
        let posChanged = false;

        if (direction.includes('e')) {
          newW = Math.max(minDims.width, Math.min(MAX_WIDGET_SIZE.width, startW + deltaX));
        } else if (direction.includes('w')) {
          newW = Math.max(minDims.width, Math.min(MAX_WIDGET_SIZE.width, startW - deltaX));
          const actualDeltaX = startW - newW;
          newX = startWinX + actualDeltaX;
          posChanged = true;
        }

        if (direction.includes('s')) {
          newH = Math.max(minDims.height, Math.min(MAX_WIDGET_SIZE.height, startH + deltaY));
        } else if (direction.includes('n')) {
          newH = Math.max(minDims.height, Math.min(MAX_WIDGET_SIZE.height, startH - deltaY));
          const actualDeltaY = startH - newH;
          newY = startWinY + actualDeltaY;
          posChanged = true;
        }

        const finalW = Math.round(newW);
        const finalH = Math.round(newH);

        lastExpandedSizeRef.current = { width: finalW, height: finalH };
        api.setWindowSize(finalW, finalH).catch(console.error);

        if (posChanged && api.isTauri()) {
          api.setWindowPosition(Math.round(newX), Math.round(newY)).catch(console.error);
        }
      });
    };

    const onMouseUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsInteracting(false);
      if (DISABLE_ACRYLIC_DURING_DRAG) {
        api.applyWindowAcrylic().catch(() => {});
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleToggleTopmost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMode: VisibilityMode = localTopmost ? 'desktop_only' : 'always_on_top';
    setLocalTopmost(!localTopmost);
    if (widgetId) {
      await setVisibilityMode(widgetId, newMode);
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

  const expandedW = lastExpandedSizeRef.current.width;
  const expandedH = lastExpandedSizeRef.current.height;
  const currentRadius = collapsed ? 9999 : (NATIVE_BLUR ? NATIVE_CORNER_RADIUS : radius);

  return (
    <div
      onMouseDown={handleDragMouseDown}
      className="relative w-screen h-screen bg-transparent select-none text-[#FFFFFF] font-sans flex justify-center items-start overflow-hidden"
      data-tauri-drag-region={!lockPosition ? '' : undefined}
    >
      {/* Fix 1 & 2: ONE persistent shell motion.div owns all glass styling. Outer shadow removed to eliminate dark rectangle. */}
      <motion.div
        ref={shellRef}
        className={cn('glass-widget overflow-hidden relative flex flex-col', NATIVE_BLUR && 'native-blur')}
        initial={false}
        animate={
          collapsed
            ? { width: capsuleW, height: capsuleH, borderRadius: 9999 }
            : { width: expandedW, height: expandedH, borderRadius: currentRadius }
        }
        transition={
          reducedMotion
            ? { duration: 0 }
            : { type: 'spring', damping: 26, stiffness: 300, mass: 0.8 }
        }
        onAnimationComplete={handleAnimationComplete}
        style={{
          borderRadius: currentRadius,
          background: NATIVE_BLUR
            ? `linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.04) 100%), rgba(20, 20, 24, ${effectiveTint})`
            : `linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.04) 100%), rgba(20, 20, 24, ${effectiveTint})`,
          border: `1px solid rgba(255, 255, 255, ${borderOpacity})`,
          ...(NATIVE_BLUR
            ? {
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              }
            : {
                backdropFilter: `blur(${blur}px) saturate(${saturateVal})`,
                WebkitBackdropFilter: `blur(${blur}px) saturate(${saturateVal})`,
              }),
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25), inset 0 -1px 0 rgba(255, 255, 255, 0.04)',
          willChange: 'width, height',
        }}
        onPointerEnter={() => setIsInteracting(true)}
        onPointerLeave={() => setIsInteracting(false)}
        onFocus={() => setIsInteracting(true)}
        onBlur={() => setIsInteracting(false)}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {!collapsed ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.92, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.9, filter: 'blur(6px)' }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : {
                    opacity: { duration: 0.24, delay: 0.1, ease: [0.32, 0.72, 0, 1] },
                    scale: { duration: 0.24, delay: 0.1, ease: [0.32, 0.72, 0, 1] },
                    filter: { duration: 0.24, delay: 0.1, ease: [0.32, 0.72, 0, 1] },
                  }
              }
              style={{
                width: expandedW,
                height: expandedH,
                minWidth: expandedW,
                minHeight: expandedH,
                borderRadius: currentRadius,
                overflow: 'hidden',
              }}
              className="relative flex flex-col overflow-hidden shrink-0"
            >
              {/* macOS White Border Drag Overlay */}
              {isDragging && (
                <div
                  style={{ borderRadius: currentRadius }}
                  className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center"
                >
                  <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/60 border border-white/30 text-white text-[11px] font-medium shadow-2xl">
                    <GripIcon size={10} className="text-white/80" />
                    <span>{title}</span>
                  </div>
                </div>
              )}

              {/* Content with smooth opacity transition during dragging */}
              <div
                className={cn(
                  'relative z-10 h-full w-full flex flex-col overflow-hidden transition-opacity duration-150',
                  isDragging ? 'opacity-0' : 'opacity-100'
                )}
              >
                {/* macOS Window Titlebar with 1px solid rgba(255,255,255,0.10) divider */}
                <div
                  className="h-9 px-3.5 flex items-center justify-between border-b border-[rgba(255,255,255,0.10)] select-none shrink-0"
                  data-tauri-drag-region={!lockPosition ? '' : undefined}
                >
                  {/* Left: macOS Traffic Lights */}
                  <div
                    onMouseEnter={() => setTrafficHovered(true)}
                    onMouseLeave={() => setTrafficHovered(false)}
                    className="flex items-center gap-2 pointer-events-auto p-1 rounded-full group/traffic cursor-default"
                  >
                    {/* Red: Close / Unpin */}
                    <button
                      onClick={handleClose}
                      className="w-3 h-3 rounded-full traffic-light-close flex items-center justify-center text-black/70 hover:text-black transition-all"
                      title="Close / Unpin Widget"
                    >
                      <svg
                        width="6"
                        height="6"
                        viewBox="0 0 6 6"
                        className={`transition-opacity duration-150 ${trafficHovered ? 'opacity-100' : 'opacity-0'
                          }`}
                      >
                        <path
                          d="M1 1L5 5M5 1L1 5"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>

                    {/* Yellow: Collapse into capsule */}
                    <button
                      onClick={() => collapse()}
                      className="w-3 h-3 rounded-full traffic-light-collapse flex items-center justify-center text-black/70 hover:text-black transition-all"
                      title="Collapse into Dynamic Island capsule"
                    >
                      <svg
                        width="6"
                        height="6"
                        viewBox="0 0 6 6"
                        className={`transition-opacity duration-150 ${trafficHovered ? 'opacity-100' : 'opacity-0'
                          }`}
                      >
                        <path
                          d="M1 3H5"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>

                    {/* Green: Always-on-top toggle */}
                    <button
                      onClick={handleToggleTopmost}
                      className="w-3 h-3 rounded-full traffic-light-topmost flex items-center justify-center text-black/70 hover:text-black transition-all"
                      title={localTopmost ? 'Always on Top (Active)' : 'Keep on Top'}
                    >
                      <svg
                        width="6"
                        height="6"
                        viewBox="0 0 6 6"
                        className={`transition-opacity duration-150 ${trafficHovered ? 'opacity-100' : 'opacity-0'
                          }`}
                      >
                        <path
                          d="M3 1V5M1 3H5"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Center: Draggable Title Text (color: rgba(255, 255, 255, 0.55)) */}
                  <div
                    className="text-xs font-medium tracking-wide cursor-grab active:cursor-grabbing truncate px-2 select-none"
                    style={{ color: 'rgba(255, 255, 255, 0.55)' }}
                    data-tauri-drag-region={!lockPosition ? '' : undefined}
                  >
                    {title}
                  </div>

                  {/* Right: Lock Position Toggle */}
                  <div className="flex items-center gap-1.5 pointer-events-auto">
                    <button
                      onClick={handleToggleLock}
                      className={`p-1.5 rounded-full transition-colors ${lockPosition
                        ? 'text-[#FFD60A] bg-[#FFD60A]/20 hover:bg-[#FFD60A]/30 border border-[#FFD60A]/40'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                      title={lockPosition ? 'Position locked' : 'Lock position'}
                    >
                      {lockPosition ? <LockIcon size={11} /> : <UnlockIcon size={11} />}
                    </button>
                  </div>
                </div>

                {/* Main Interactive Content */}
                <div
                  className={`flex-1 w-full min-h-0 overflow-hidden flex flex-col text-[#FFFFFF] ${dimensions.isXs ? 'p-2' : dimensions.isShort ? 'p-2.5' : 'p-3'
                    }`}
                >
                  {children}
                </div>

                {/* Edge and Corner Resize Handles */}
                {!lockPosition && (
                  <>
                    <div
                      onMouseDown={(e) => handleResizeStart(e, 'e')}
                      className="resize-handle absolute top-3 right-0 w-2 h-[calc(100%-24px)] cursor-e-resize z-40 hover:bg-white/10 transition-colors"
                      title="Drag edge to resize width"
                    />
                    <div
                      onMouseDown={(e) => handleResizeStart(e, 's')}
                      className="resize-handle absolute bottom-0 left-3 w-[calc(100%-24px)] h-2 cursor-s-resize z-40 hover:bg-white/10 transition-colors"
                      title="Drag edge to resize height"
                    />
                    <div
                      onMouseDown={(e) => handleResizeStart(e, 'w')}
                      className="resize-handle absolute top-3 left-0 w-2 h-[calc(100%-24px)] cursor-w-resize z-40 hover:bg-white/10 transition-colors"
                      title="Drag edge to resize width"
                    />
                    <div
                      onMouseDown={(e) => handleResizeStart(e, 'n')}
                      className="resize-handle absolute top-0 left-3 w-[calc(100%-24px)] h-2 cursor-n-resize z-40 hover:bg-white/10 transition-colors"
                      title="Drag edge to resize height"
                    />
                    <div
                      onMouseDown={(e) => handleResizeStart(e, 'se')}
                      className="resize-handle absolute bottom-0 right-0 w-6 h-6 flex items-end justify-end p-2.5 cursor-se-resize select-none z-50 group/resize"
                      title="Drag corner to resize widget"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover/resize:bg-white/80 transition-colors shadow-sm" />
                    </div>
                    <div
                      onMouseDown={(e) => handleResizeStart(e, 'sw')}
                      className="resize-handle absolute bottom-0 left-0 w-6 h-6 cursor-sw-resize select-none z-50"
                      title="Drag corner to resize widget"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white/20 hover:bg-white/80 transition-colors" />
                    </div>
                    <div
                      onMouseDown={(e) => handleResizeStart(e, 'ne')}
                      className="resize-handle absolute top-0 right-0 w-6 h-6 cursor-ne-resize select-none z-50"
                      title="Drag corner to resize widget"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white/20 hover:bg-white/80 transition-colors" />
                    </div>
                    <div
                      onMouseDown={(e) => handleResizeStart(e, 'nw')}
                      className="resize-handle absolute top-0 left-0 w-6 h-6 cursor-nw-resize select-none z-50"
                      title="Drag corner to resize widget"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white/20 hover:bg-white/80 transition-colors" />
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="capsule"
              initial={{ opacity: 0, scale: 1.1, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.9, filter: 'blur(4px)' }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : {
                    opacity: { duration: 0.24, delay: 0.16, ease: [0.32, 0.72, 0, 1] },
                    scale: { duration: 0.24, delay: 0.16, ease: [0.32, 0.72, 0, 1] },
                    filter: { duration: 0.24, delay: 0.16, ease: [0.32, 0.72, 0, 1] },
                  }
              }
              style={{
                width: capsuleW,
                height: capsuleH,
              }}
              className="flex items-center justify-center w-full h-full overflow-hidden select-none"
            >
              <WidgetCapsule widgetType={widgetType} onExpand={handleExpand} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
