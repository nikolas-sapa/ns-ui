"use client";

// ---------------------------------------------------------------------------
// HingeTopple — an ambient loading glyph shaped as a die tumbling face over
// face on a fixed axle. Four pip-marked faces ring a CSS 3D cube; one
// rotateY keyframe steps it through them 90deg at a time, but each quarter
// isn't a clean rotation to its target — it eases in fast (ease-out-expo),
// swings 8deg past the landing face, then corrects back on the house spring
// curve (cubic-bezier(.34,1.56,.64,1), the same overshoot used for
// dovetail-run's chip seat), so every landing reads as weight catching
// itself rather than an animation hitting a number. A soft floor shadow
// underneath compresses as the cube rocks up off it and flares as it lands,
// entirely in CSS, synced to the same four-beat timeline.
// ---------------------------------------------------------------------------

const PIP_LAYOUT: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[50, 50]],
  2: [
    [30, 30],
    [70, 70],
  ],
  3: [
    [30, 30],
    [50, 50],
    [70, 70],
  ],
  4: [
    [30, 30],
    [70, 30],
    [30, 70],
    [70, 70],
  ],
};

const FACES: ReadonlyArray<{ pips: number; transform: string; shade: number }> = [
  { pips: 1, transform: "rotateY(0deg)", shade: 0 },
  { pips: 2, transform: "rotateY(90deg)", shade: 10 },
  { pips: 3, transform: "rotateY(180deg)", shade: 16 },
  { pips: 4, transform: "rotateY(-90deg)", shade: 10 },
];

const CSS = `
.ns-ht-stage{
  position:relative;
  perspective:calc(var(--ns-ht-size) * 5);
  width:var(--ns-ht-size);
  height:var(--ns-ht-size);
}
.ns-ht-cube{
  position:absolute;
  inset:0;
  transform-style:preserve-3d;
  animation:ns-ht-spin var(--ns-ht-period) infinite;
}
.ns-ht-face{
  position:absolute;
  inset:0;
  border-radius:6px;
  border:1px solid var(--border);
  background:var(--surface);
  backface-visibility:hidden;
  display:grid;
  grid-template-columns:repeat(3,1fr);
  grid-template-rows:repeat(3,1fr);
  padding:18%;
}
.ns-ht-face::before{
  content:"";
  position:absolute;
  inset:0;
  border-radius:6px;
  background:var(--ns-ht-shade);
  pointer-events:none;
}
.ns-ht-pip{
  width:14%;
  height:14%;
  border-radius:9999px;
  background:var(--foreground);
  align-self:center;
  justify-self:center;
}
.ns-ht-floor{
  position:absolute;
  left:50%;
  bottom:-10%;
  width:70%;
  height:10%;
  transform:translateX(-50%);
  border-radius:9999px;
  background:var(--foreground);
  filter:blur(3px);
  animation:ns-ht-floor var(--ns-ht-period) infinite;
}
@keyframes ns-ht-spin{
  0%{transform:rotateY(0deg);animation-timing-function:linear}
  14%{transform:rotateY(0deg);animation-timing-function:cubic-bezier(.16,1,.3,1)}
  20%{transform:rotateY(-98deg);animation-timing-function:cubic-bezier(.34,1.56,.64,1)}
  25%{transform:rotateY(-90deg);animation-timing-function:linear}
  39%{transform:rotateY(-90deg);animation-timing-function:cubic-bezier(.16,1,.3,1)}
  45%{transform:rotateY(-188deg);animation-timing-function:cubic-bezier(.34,1.56,.64,1)}
  50%{transform:rotateY(-180deg);animation-timing-function:linear}
  64%{transform:rotateY(-180deg);animation-timing-function:cubic-bezier(.16,1,.3,1)}
  70%{transform:rotateY(-278deg);animation-timing-function:cubic-bezier(.34,1.56,.64,1)}
  75%{transform:rotateY(-270deg);animation-timing-function:linear}
  89%{transform:rotateY(-270deg);animation-timing-function:cubic-bezier(.16,1,.3,1)}
  95%{transform:rotateY(-368deg);animation-timing-function:cubic-bezier(.34,1.56,.64,1)}
  100%{transform:rotateY(-360deg)}
}
@keyframes ns-ht-floor{
  0%,14%{transform:translateX(-50%) scaleX(1);opacity:.45}
  20%,45%,70%,95%{transform:translateX(-50%) scaleX(.55);opacity:.28}
  25%,50%,75%,100%{transform:translateX(-50%) scaleX(1.2);opacity:.6}
  39%,64%,89%{transform:translateX(-50%) scaleX(1);opacity:.45}
}
@media (prefers-reduced-motion: reduce){
  .ns-ht-cube,.ns-ht-floor{animation:none;}
  .ns-ht-floor{transform:translateX(-50%) scaleX(1);opacity:.45;}
}
`;

export interface HingeToppleProps {
  /** cube edge length in px */
  size?: number;
  /** ms for one full four-face loop */
  periodMs?: number;
  /** text announced via the component's own aria-live region */
  label?: string;
  className?: string;
}

export function HingeTopple({
  size = 48,
  periodMs = 4800,
  label = "Loading",
  className = "",
}: HingeToppleProps) {
  const half = size / 2;
  return (
    <span
      role="status"
      aria-live="polite"
      data-hinge-topple
      className={`inline-flex items-center justify-center ${className}`}
      style={{
        width: size,
        paddingBottom: size * 0.18,
        ["--ns-ht-size" as string]: `${size}px`,
        ["--ns-ht-period" as string]: `${periodMs}ms`,
      }}
    >
      <style>{CSS}</style>
      <span className="ns-ht-stage" aria-hidden="true">
        <span className="ns-ht-cube">
          {FACES.map((face) => (
            <span
              key={face.pips}
              className="ns-ht-face"
              style={{
                transform: `${face.transform} translateZ(${half}px)`,
                ["--ns-ht-shade" as string]: `color-mix(in srgb, var(--foreground) ${face.shade}%, transparent)`,
              }}
            >
              {PIP_LAYOUT[face.pips]!.map(([x, y], i) => (
                <span
                  key={i}
                  className="ns-ht-pip"
                  style={{ gridColumn: x < 50 ? 1 : x > 50 ? 3 : 2, gridRow: y < 50 ? 1 : y > 50 ? 3 : 2 }}
                />
              ))}
            </span>
          ))}
        </span>
        <span className="ns-ht-floor" />
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
