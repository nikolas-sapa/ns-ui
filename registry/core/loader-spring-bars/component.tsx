"use client";

// ---------------------------------------------------------------------------
// LathRack — an ambient loading glyph shaped as a row of leaf springs
// mounted on a rail, one shared displacement passing through them left to
// right. Each lath runs the identical keyframe (compressed rest -> rise,
// past its own height, on ease-out-expo -> a two-beat decaying overshoot on
// the house spring curve -> back to rest) but at a negative animation-delay
// staggered by index, so what's actually one waveform looks like a pulse
// of energy travelling down the rack rather than N bars animating in
// isolation — the same "one rule, offset per element" trick loader-pendulum-sync
// uses for its pendulum row, here on translateY/scaleY instead of rotation.
// ---------------------------------------------------------------------------

const CSS = `
.ns-lr-rack{
  display:flex;
  align-items:flex-end;
  justify-content:center;
  gap:calc(var(--ns-lr-bar) * .6);
  height:var(--ns-lr-height);
}
.ns-lr-bar{
  width:var(--ns-lr-bar);
  height:100%;
  border-radius:9999px;
  background:var(--foreground);
  transform-origin:bottom center;
  animation:ns-lr-pulse var(--ns-lr-period) infinite;
}
@keyframes ns-lr-pulse{
  0%,18%{transform:scaleY(.38);animation-timing-function:cubic-bezier(.16,1,.3,1)}
  30%{transform:scaleY(1.16);animation-timing-function:cubic-bezier(.34,1.56,.64,1)}
  38%{transform:scaleY(.88);animation-timing-function:cubic-bezier(.34,1.56,.64,1)}
  46%{transform:scaleY(1.05);animation-timing-function:cubic-bezier(.16,1,.3,1)}
  54%,100%{transform:scaleY(.38)}
}
@media (prefers-reduced-motion: reduce){
  .ns-lr-bar{animation:none;transform:scaleY(.7);opacity:.7;}
}
`;

export interface LathRackProps {
  /** number of laths, clamped 3-9 */
  count?: number;
  /** rack height in px */
  height?: number;
  /** ms for one full pulse to sweep across the rack and repeat */
  periodMs?: number;
  /** text announced via the component's own aria-live region */
  label?: string;
  className?: string;
}

export function LathRack({
  count = 5,
  height = 40,
  periodMs = 2200,
  label = "Loading",
  className = "",
}: LathRackProps) {
  const n = Math.min(9, Math.max(3, Math.round(count)));
  const bar = Math.max(3, Math.round(height * 0.11));
  const step = periodMs * 0.085;

  return (
    <span
      role="status"
      aria-live="polite"
      data-loader-spring-bars
      className={`inline-flex items-end ${className}`}
      style={{
        height,
        ["--ns-lr-bar" as string]: `${bar}px`,
        ["--ns-lr-height" as string]: `${height}px`,
        ["--ns-lr-period" as string]: `${periodMs}ms`,
      }}
    >
      <style>{CSS}</style>
      <span className="ns-lr-rack" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <span
            key={i}
            className="ns-lr-bar"
            style={{ animationDelay: `${-(i * step)}ms` }}
          />
        ))}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
