import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '@/services/tauriApi';
import { WidgetType } from '@/types/widget';
import { useAppearanceStore } from '@/stores/appearanceStore';

export interface DynamicIslandConfig {
  widgetId: string;
  widgetType: WidgetType;
  defaultExpandedWidth: number;
  defaultExpandedHeight: number;
  initialCollapsed?: boolean;
}

export function getCapsuleDimensions(type: WidgetType): { width: number; height: number } {
  switch (type) {
    case 'clock':
      return { width: 144, height: 36 };
    case 'focus':
      return { width: 160, height: 36 };
    case 'tasks':
      return { width: 156, height: 36 };
    case 'notes':
      return { width: 150, height: 36 };
    case 'deadlines':
      return { width: 164, height: 36 };
    case 'goals':
      return { width: 152, height: 36 };
    default:
      return { width: 150, height: 36 };
  }
}

export function useDynamicIsland({
  widgetId,
  widgetType,
  defaultExpandedWidth,
  defaultExpandedHeight,
}: DynamicIslandConfig) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const expandedSizeRef = useRef({
    width: defaultExpandedWidth,
    height: defaultExpandedHeight,
  });

  const autoCollapseRaw = useAppearanceStore((state) => state.autoCollapse);
  const collapseDelaySeconds = useAppearanceStore((state) => state.collapseDelaySeconds ?? 30);
  const autoCollapse = (autoCollapseRaw ?? false) && api.isTauri();

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const autoCollapseRef = useRef(autoCollapse);
  autoCollapseRef.current = autoCollapse;
  const collapseDelaySecondsRef = useRef(collapseDelaySeconds);
  collapseDelaySecondsRef.current = collapseDelaySeconds;
  const isInteractingRef = useRef(isInteracting);
  isInteractingRef.current = isInteracting;
  const isCollapsedRef = useRef(isCollapsed);
  isCollapsedRef.current = isCollapsed;

  // Update expanded size when native window is resized while expanded
  const updateExpandedDimensions = useCallback((width: number, height: number) => {
    if (!isCollapsedRef.current && width > 180 && height > 80) {
      expandedSizeRef.current = { width, height };
    }
  }, []);

  // Collapse into capsule
  const collapse = useCallback(async () => {
    if (isCollapsedRef.current) return;
    const capsule = getCapsuleDimensions(widgetType);
    setIsCollapsed(true);

    try {
      // Resize actual native OS window
      await api.setWindowSize(capsule.width, capsule.height);
      if (widgetId) {
        await api.toggleCollapseWidget(widgetId, true);
      }
    } catch {
      // Ignore
    }
  }, [widgetType, widgetId]);

  // Expand back to full widget
  const expand = useCallback(async () => {
    const { width, height } = expandedSizeRef.current;
    setIsCollapsed(false);

    try {
      // Resize actual native OS window back to previous expanded size
      await api.setWindowSize(width, height);
      if (widgetId) {
        await api.toggleCollapseWidget(widgetId, false);
      }
    } catch {
      // Ignore
    }

    resetInactivityTimer();
  }, [widgetId]);

  // Reset inactivity countdown
  const resetInactivityTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!autoCollapseRef.current || isCollapsedRef.current || isInteractingRef.current) {
      return;
    }

    timerRef.current = setTimeout(() => {
      // Check if any text input / textarea is currently focused
      const activeEl = document.activeElement;
      const isInputActive =
        activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable);

      if (!isInputActive) {
        collapse();
      } else {
        // Retry after input blurs
        resetInactivityTimer();
      }
    }, collapseDelaySecondsRef.current * 1000);
  }, [collapse]);

  // Interaction event listeners
  useEffect(() => {
    if (isCollapsed) return;

    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    const handleFocusIn = () => {
      setIsInteracting(true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    const handleFocusOut = () => {
      setIsInteracting(false);
      resetInactivityTimer();
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('mousedown', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    // Initial countdown start
    resetInactivityTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('mousedown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, [isCollapsed, resetInactivityTimer]);

  return {
    isCollapsed,
    collapse,
    expand,
    toggleCollapse: isCollapsed ? expand : collapse,
    updateExpandedDimensions,
    setIsInteracting,
  };
}
