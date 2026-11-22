import React, { type CSSProperties, type ReactNode } from "react";
import "./GlassWidget.css";

export interface GlassWidgetProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  /** Corner radius in pixels: 24 to 28 (default: 28) */
  radius?: number;
  /** Backdrop blur in pixels (default: 20) */
  blur?: number;
  /** Backdrop saturation percentage (default: 130) */
  saturate?: number | string;
  /** Translucent glass dark tint opacity: 0.18 to 0.45 (default: 0.28) */
  tint?: number;
  /** Legacy alias for tint */
  opacity?: number;
  /** Border alpha opacity of white (default: 0.14) */
  borderOpacity?: number;
  style?: CSSProperties;
}

export default function GlassWidget({
  children,
  className = "",
  radius = 14,
  blur = 20,
  saturate = 130,
  tint = 0.28,
  opacity,
  borderOpacity = 0.14,
  style: userStyle,
  ...rest
}: GlassWidgetProps) {
  const effectiveTint = opacity !== undefined ? opacity : tint;
  const saturateVal = typeof saturate === "number" ? `${saturate}%` : saturate;

  const style = {
    "--glass-radius": `${radius}px`,
    "--glass-blur": `${blur}px`,
    "--glass-saturation": saturateVal,
    "--glass-tint": effectiveTint,
    "--glass-opacity": effectiveTint,
    "--glass-border": `rgba(255, 255, 255, ${borderOpacity})`,
    ...userStyle,
  } as CSSProperties;

  return (
    <div className={`glass-widget ${className}`} style={style} {...rest}>
      <div className="glass-widget__content" style={{ borderRadius: `${radius}px`, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

export { GlassWidget };
