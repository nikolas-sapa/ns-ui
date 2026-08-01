"use client";

// ---------------------------------------------------------------------------
// BladeIris — an ambient loading glyph shaped as a six-blade camera-iris
// diaphragm breathing open and shut inside a fixed housing ring. Each blade
// is one wedge polygon, repeated six times via SVG <g rotate(60*i 50 50)>,
// so only one shape is authored; the aperture itself is driven by a single
// shared translateY keyframe every blade runs identically (retreating
// toward the housing to open, sliding back toward center to close) — the
// hex hole in the middle is purely the six wedges' tips moving in unison,
// never a separately drawn shape. Both the open and the close leg ease in
// fast then overshoot their target before correcting on the house spring
// curve, so the aperture reads as spring-tensioned blades snapping to a
// stop rather than a shape tweening between two states.
// ---------------------------------------------------------------------------

const CSS = `
.ns-bi-blade{
  transform-box:fill-box;
  transform-origin:center;
  animation:ns-bi-breathe var(--ns-bi-period) infinite;
}
@keyframes ns-bi-breathe{
  0%,10%{transform:translateY(0px);animation-timing-function:cubic-bezier(.16,1,.3,1)}
  22%{transform:translateY(-9px);animation-timing-function:cubic-bezier(.34,1.56,.64,1)}
  28%{transform:translateY(-7.5px)}
  55%{transform:translateY(-7.5px);animation-timing-function:cubic-bezier(.16,1,.3,1)}
  67%{transform:translateY(1px);animation-timing-function:cubic-bezier(.34,1.56,.64,1)}
  73%,100%{transform:translateY(0px)}
}
@media (prefers-reduced-motion: reduce){
  .ns-bi-blade{animation:none;transform:translateY(-4px);}
}
`;

const BLADE_D = "M 50 47 L 37 12 L 63 12 Z";

export interface BladeIrisProps {
  /** glyph size in px */
  size?: number;
  /** ms for one full open-close breath */
  periodMs?: number;
  /** text announced via the component's own aria-live region */
  label?: string;
  className?: string;
}

export function BladeIris({
  size = 40,
  periodMs = 2600,
  label = "Loading",
  className = "",
}: BladeIrisProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      data-loader-iris
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <style>{CSS}</style>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
        style={{ ["--ns-bi-period" as string]: `${periodMs}ms` }}
      >
        <circle cx={50} cy={50} r={46} fill="none" stroke="var(--border)" strokeWidth={1.5} />
        {Array.from({ length: 6 }, (_, i) => (
          <g key={i} transform={`rotate(${i * 60} 50 50)`}>
            <path
              className="ns-bi-blade"
              d={BLADE_D}
              fill="color-mix(in srgb, var(--foreground) 82%, transparent)"
              stroke="var(--surface)"
              strokeWidth={1}
              strokeLinejoin="round"
            />
          </g>
        ))}
        <circle cx={50} cy={50} r={2.5} fill="var(--foreground)" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
