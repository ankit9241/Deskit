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
  isShort: boolean;
}

export function useWidgetDimensions(containerRef?: RefObject<HTMLElement | null>): WidgetDimensions {
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => {
    if (typeof window !== 'undefined') {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    return { width: 300, height: 220 };
  });

  useEffect(() => {
    const target = containerRef?.current || document.documentElement;

    const updateSize = (w: number, h: number) => {
      const roundedW = Math.round(w);
      const roundedH = Math.round(h);
      setDimensions((prev) => {
        if (Math.abs(prev.width - roundedW) < 3 && Math.abs(prev.height - roundedH) < 3) {
          return prev;
        }
        return { width: roundedW, height: roundedH };
      });
    };

    // Initial measurement
    if (target) {
      const rect = target.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        updateSize(rect.width, rect.height);
      }
    }

    // ResizeObserver for precise container monitoring
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && target) {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            updateSize(width, height);
          }
        }
      });
      observer.observe(target);
    }

    const handleWindowResize = () => {
      if (target) {
        const rect = target.getBoundingClientRect();
        updateSize(rect.width || window.innerWidth, rect.height || window.innerHeight);
      }
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [containerRef]);

  const { width, height } = dimensions;

  // Compute 4 responsive states
  const isXs = width < 230 || height < 150;
  const isS = !isXs && (width < 330 || height < 240);
  const isM = !isXs && !isS && (width < 450 || height < 350);
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
    isNarrow: width < 260,
    isShort: height < 180,
  };
}
