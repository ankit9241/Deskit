import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '@/services/tauriApi';
import { WidgetType } from '@/types/widget';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useFocusStore } from '@/stores/focusStore';

export interface DynamicIslandConfig {
  widgetId: string;
  widgetType: WidgetType;
  defaultExpandedWidth: number;
  defaultExpandedHeight: number;
  initialCollapsed?: boolean;
  /** Idle delay before auto-collapse in ms (default: 3000). */
  idleDelayMs?: number;
  /** Collapse / expand morph duration in ms (default: 650). */
  durationMs?: number;
  collapsedSize?: { width: number; height: number };
  expandedSize?: { width: number; height: number };
  collapsedRadius?: number;
  expandedRadius?: number;
  manualWindowResize?: boolean;
}

export interface DynamicIslandMetrics {
  duration: number;
  /** Live ref — synced every render and by window resizes. */
  collapsedSize: React.RefObject<{ width: number; height: number }>;
  /** Live ref — synced every render and by window resizes. */
  expandedSize: React.RefObject<{ width: number; height: number }>;
  collapsedRadius: React.RefObject<number>;
  expandedRadius: React.RefObject<number>;
}

export interface DynamicIslandReturn {
  collapsed: boolean;
  collapse: () => void;
  expand: () => void;
  toggleCollapse: () => void;
  setIsInteracting: (val: boolean) => void;
  setMenuOpen: (val: boolean) => void;
  updateExpandedDimensions: (width: number, height: number) => void;
  metrics: DynamicIslandMetrics;
}

export function getCapsuleDimensions(type: WidgetType): { width: number; height: number } {
  switch (type) {
    case 'clock':
      return { width: 158, height: 42 };
    case 'focus':
      return { width: 168, height: 42 };
    case 'tasks':
      return { width: 168, height: 42 };
    case 'notes':
      return { width: 158, height: 42 };
    case 'deadlines':
      return { width: 172, height: 42 };
    case 'goals':
      return { width: 158, height: 42 };
    default:
      return { width: 160, height: 42 };
  }
}

export function useDynamicIsland({
  widgetId,
  widgetType,
  defaultExpandedWidth,
  defaultExpandedHeight,
  initialCollapsed = false,
  idleDelayMs: idleDelayMsProp,
  durationMs = 650,
  collapsedSize: collapsedSizeProp = { width: 158, height: 46 },
  expandedSize: expandedSizeProp = { width: 300, height: 150 },
  collapsedRadius = 23,
  expandedRadius = 28,
  manualWindowResize = false,
}: DynamicIslandConfig): DynamicIslandReturn {
  const autoCollapseRaw = useAppearanceStore((state) => state.autoCollapse);
  const collapseDelaySeconds = useAppearanceStore((state) => state.collapseDelaySeconds ?? 5);
  const autoCollapse = autoCollapseRaw !== false;

  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const isCollapsedRef = useRef(collapsed);
  isCollapsedRef.current = collapsed;
  const isExpandingRef = useRef(false);
  const isInteractingRef = useRef(false);
  const isMenuOpenRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const autoCollapseRef = useRef(autoCollapse);
  autoCollapseRef.current = autoCollapse;
  const collapseDelaySecondsRef = useRef(collapseDelaySeconds);
  collapseDelaySecondsRef.current = collapseDelaySeconds;
  const idleDelayMsRef = useRef(
    idleDelayMsProp ?? (autoCollapse ? collapseDelaySeconds * 1000 : 3000)
  );
  idleDelayMsRef.current = idleDelayMsRef.current;

  // Live size / radius refs: the component owns the values, the hook mirrors
  // them so expand() can size the native window to the current natural size.
  const collapsedSizeRef = useRef(collapsedSizeProp);
  collapsedSizeRef.current = collapsedSizeProp;
  const expandedSizeRef = useRef({
    width: Math.max(160, defaultExpandedWidth),
    height: Math.max(80, defaultExpandedHeight),
  });
  expandedSizeRef.current = expandedSizeProp;
  const collapsedRadiusRef = useRef(collapsedRadius);
  collapsedRadiusRef.current = collapsedRadius;
  const expandedRadiusRef = useRef(expandedRadius);
  expandedRadiusRef.current = expandedRadius;

  // Track if focus timer is running (focus widget only collapses while running)
  const isTimerRunning = useFocusStore((state) => state.session?.is_running ?? false);
  const isTimerRunningRef = useRef(isTimerRunning);
  isTimerRunningRef.current = isTimerRunning;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Collapse into capsule.
  const collapse = useCallback(() => {
    if (isCollapsedRef.current) return;
    setCollapsed(true);
    isCollapsedRef.current = true;
    clearTimer();

    if (!manualWindowResize) {
      const capDims = getCapsuleDimensions(widgetType);
      if (api.isTauri()) {
        api.setWindowSize(capDims.width, capDims.height).catch(() => {});
      }

      if (widgetId) {
        api.toggleCollapseWidget(widgetId, true).catch(() => {});
      }
    }
  }, [widgetId, widgetType, clearTimer, manualWindowResize]);

  // Reset inactivity countdown. No setInterval polling — a single setTimeout.
  const resetInactivityTimer = useCallback(() => {
    clearTimer();

    if (
      isCollapsedRef.current ||
      isInteractingRef.current ||
      isMenuOpenRef.current
    ) {
      return;
    }

    // 1. Focus widget: MUST collapse after idle delay when the timer is running.
    // 2. Other widgets: collapse after idle delay if auto-collapse is enabled.
    const shouldAutoCollapse =
      widgetType === 'focus' ? isTimerRunningRef.current : autoCollapseRef.current;

    if (!shouldAutoCollapse) {
      return;
    }

    timerRef.current = setTimeout(() => {
      // Don't collapse while the user is actively typing in an input.
      const activeEl = document.activeElement;
      const isInputActive =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

      if (!isInputActive) {
        collapse();
      } else {
        // Retry once the input loses focus.
        resetInactivityTimer();
      }
    }, idleDelayMsRef.current);
  }, [collapse, widgetType]);

  // Expand back to full widget.
  const expand = useCallback(() => {
    if (!isCollapsedRef.current) return;
    isExpandingRef.current = true;
    setCollapsed(false);
    isCollapsedRef.current = false;
    isExpandingRef.current = false;
    // Restart the idle countdown so it can squeeze again.
    resetInactivityTimer();

    if (!manualWindowResize) {
      const targetW = expandedSizeRef.current?.width || defaultExpandedWidth;
      const targetH = expandedSizeRef.current?.height || defaultExpandedHeight;
      if (api.isTauri()) {
        api.setWindowSize(targetW, targetH).catch(() => {});
      }

      if (widgetId) {
        api.toggleCollapseWidget(widgetId, false).catch(() => {});
      }
    }
  }, [widgetId, defaultExpandedWidth, defaultExpandedHeight, resetInactivityTimer, manualWindowResize]);

  // Sync initial window size if widget starts collapsed
  useEffect(() => {
    if (initialCollapsed && !manualWindowResize) {
      const capDims = getCapsuleDimensions(widgetType);
      if (api.isTauri()) {
        api.setWindowSize(capDims.width, capDims.height).catch(() => {});
      }
    }
  }, [initialCollapsed, widgetType, manualWindowResize]);

  const setIsInteracting = useCallback(
    (val: boolean) => {
      isInteractingRef.current = val;
      if (!val) {
        resetInactivityTimer();
      } else if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    [resetInactivityTimer]
  );

  // A widget menu / popover being open also blocks auto-collapse.
  const setMenuOpen = useCallback((val: boolean) => {
    isMenuOpenRef.current = val;
    if (val) {
      clearTimer();
    } else {
      resetInactivityTimer();
    }
  }, [clearTimer, resetInactivityTimer]);

  // Monitor focus timer start/pause transitions
  useEffect(() => {
    if (widgetType === 'focus') {
      if (isTimerRunning && !collapsed) {
        resetInactivityTimer();
      } else if (!isTimerRunning && timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isTimerRunning, collapsed, widgetType, resetInactivityTimer]);

  // Interaction event listeners for user activity
  useEffect(() => {
    if (collapsed) return;

    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    const handleFocusIn = () => {
      isInteractingRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    const handleFocusOut = () => {
      isInteractingRef.current = false;
      resetInactivityTimer();
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('pointermove', handleUserActivity);
    window.addEventListener('mousedown', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('wheel', handleUserActivity, { passive: true });
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    // Initial countdown start
    resetInactivityTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('pointermove', handleUserActivity);
      window.removeEventListener('mousedown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('wheel', handleUserActivity);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, [collapsed, resetInactivityTimer]);

  return {
    collapsed,
    collapse,
    expand,
    toggleCollapse: isCollapsedRef.current ? expand : collapse,
    updateExpandedDimensions: useCallback((width: number, height: number) => {
      if (!isCollapsedRef.current && width > 160 && height > 70) {
        expandedSizeRef.current = { width: Math.round(width), height: Math.round(height) };
      }
    }, []),
    setIsInteracting,
    setMenuOpen,
    metrics: {
      duration: durationMs,
      collapsedSize: collapsedSizeRef,
      expandedSize: expandedSizeRef,
      collapsedRadius: collapsedRadiusRef,
      expandedRadius: expandedRadiusRef,
    },
  };
}
