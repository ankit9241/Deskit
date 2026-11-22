import { useState, useEffect, RefObject } from 'react';

export type WidgetSizeTier = 'xs' | 's' | 'm' | 'l';

export interface WidgetDimensions {
  width: number;
  height: number;
  tier: WidgetSizeTier;
  isXs: boolean;
  isS: boolean;
  isM: boolean;
  isL: boolean;
  isNarrow: boolean;
  isVeryNarrow: boolean;
  isShort: boolean;
  isVeryShort: boolean;
  isWide: boolean;
  isTall: boolean;
}

export function useWidgetDimensions(containerRef?: RefObject<HTMLElement | null>): WidgetDimensions {
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => {
    if (typeof window !== 'undefined') {
      return { width: window.innerWidth || 280, height: window.innerHeight || 180 };
    }
    return { width: 280, height: 180 };
  });

  useEffect(() => {
    let rafId: number | null = null;

    const updateSize = (w: number, h: number) => {
      const roundedW = Math.round(w);
      const roundedH = Math.round(h);
      if (roundedW <= 0 || roundedH <= 0) return;

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        setDimensions((prev) => {
          if (Math.abs(prev.width - roundedW) < 2 && Math.abs(prev.height - roundedH) < 2) {
            return prev;
          }
          return { width: roundedW, height: roundedH };
        });
      });
    };

    // If containerRef is provided and valid, use ResizeObserver
    let observer: ResizeObserver | null = null;
    if (containerRef && containerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            updateSize(entry.contentRect.width, entry.contentRect.height);
          }
        }
      });
      observer.observe(containerRef.current);
    }

    const handleWindowResize = () => {
      if (typeof window === 'undefined') return;
      if (!containerRef || !containerRef.current) {
        updateSize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('resize', handleWindowResize);

    // Initial measurement
    if (containerRef?.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        updateSize(rect.width, rect.height);
      }
    } else if (typeof window !== 'undefined') {
      updateSize(window.innerWidth, window.innerHeight);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [containerRef]);

  const { width, height } = dimensions;

  // Compute responsive states
  const isXs = width < 240 || height < 130;
  const isS = !isXs && (width < 340 || height < 220);
  const isM = !isXs && !isS && (width < 480 || height < 340);
  const isL = !isXs && !isS && !isM;

  const tier: WidgetSizeTier = isXs ? 'xs' : isS ? 's' : isM ? 'm' : 'l';

  return {
    width,
    height,
    tier,
    isXs,
    isS,
    isM,
    isL,
    isNarrow: width < 280,
    isVeryNarrow: width < 220,
    isShort: height < 180,
    isVeryShort: height < 140,
    isWide: width > 460,
    isTall: height > 360,
  };
}
