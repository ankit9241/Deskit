import React, { forwardRef } from 'react';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Alpha opacity of the dark fill rgba(24, 24, 26, tint): 0.18 to 0.45 (default: 0.28).
   * Tuning:
   * - Behind content too hard to see: lower tint to 0.18 to 0.22.
   * - Too see-through for readability: raise tint to 0.35 to 0.40. Never go above 0.45.
   */
  tint?: number;
  /**
   * Backdrop blur in pixels (default: 20).
   * Tuning:
   * - Objects behind still too sharp: raise blur to 24 to 28.
   * - Behind content too hard to see: lower blur to 16.
   */
  blur?: number;
  /** Backdrop saturation percentage (default: 130) */
  saturate?: number | string;
  /** Corner radius in pixels: 24 to 28 (default: 28) */
  radius?: number;
  /** Border alpha opacity of white (default: 0.14) */
  borderOpacity?: number;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Reusable GlassCard wrapper component implementing premium "liquid glass" styling:
 * light, neutral, only moderately blurred, so whatever is behind the card stays visible
 * as soft blurred shapes.
 *
 * Exact CSS Specification:
 * - background:
 *     linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.04) 100%),
 *     rgba(24, 24, 26, tint);
 * - border: 1px solid rgba(255, 255, 255, borderOpacity);
 * - border-radius: radius px;
 * - backdrop-filter: blur(blur px) saturate(saturate);
 * - -webkit-backdrop-filter: blur(blur px) saturate(saturate);
 * - box-shadow:
 *     0 30px 60px rgba(0, 0, 0, 0.5),
 *     inset 0 1px 0 rgba(255, 255, 255, 0.25),
 *     inset 0 -1px 0 rgba(255, 255, 255, 0.04);
 * - box-sizing: border-box;
 *
 * Tuning guide (expose as props, do not hardcode elsewhere):
 * - Objects behind still too sharp: raise blur to 24 to 28.
 * - Behind content too hard to see: lower tint to 0.18 to 0.22, or blur to 16.
 * - Too see-through for readability: raise tint to 0.35 to 0.40. Never go above 0.45.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      tint = 0.28,
      blur = 20,
      saturate = 130,
      radius = 14,
      borderOpacity = 0.14,
      children,
      className = '',
      style,
      ...rest
    },
    ref
  ) => {
    const saturateVal = typeof saturate === 'number' ? `${saturate}%` : saturate;

    const dynamicStyle: React.CSSProperties = {
      background: `linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.04) 100%), rgba(24, 24, 26, ${tint})`,
      border: `1px solid rgba(255, 255, 255, ${borderOpacity})`,
      borderRadius: `${radius}px`,
      backdropFilter: `blur(${blur}px) saturate(${saturateVal})`,
      WebkitBackdropFilter: `blur(${blur}px) saturate(${saturateVal})`,
      boxShadow:
        '0 30px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.25), inset 0 -1px 0 rgba(255, 255, 255, 0.04)',
      boxSizing: 'border-box',
      ...style,
    };

    return (
      <div
        ref={ref}
        className={`box-border ${className}`.trim()}
        style={dynamicStyle}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

export default GlassCard;
