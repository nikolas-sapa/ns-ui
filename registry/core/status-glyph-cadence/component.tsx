"use client";

// ---------------------------------------------------------------------------
// BeaconCadence — an inline status glyph for agent/AI work where the MOTION
// PATTERN is the signal, not color and not a swapped icon. One field of six
// SVG dots (a hexagonal ring) plus a center accent; each state gives that
// same field a distinct cadence: working spins it steadily, searching sweeps
// a bright cluster back and forth across a bounded arc, awaiting-input holds
// everything still but breathes a center dot, blocked snap-jitters the ring
// through a broken gap, done stops moving entirely on a complete ring with a
// settle-in checkmark. Every dot's resting (non-animated) opacity is chosen
// so the shape alone reads as that state — that resting frame is also
// exactly what prefers-reduced-motion falls back to, so reduced motion never
// collapses two states into the same frozen spinner. Pure CSS keyframes on
// SVG transforms, all ink from --foreground, zero dependencies.
// ---------------------------------------------------------------------------

export type BeaconCadenceState =
  | "working"
  | "searching"
  | "awaiting-input"
  | "blocked"
  | "done";

const STATE_LABEL: Record<BeaconCadenceState, string> = {
  working: "Working",
  searching: "Searching",
  "awaiting-input": "Awaiting input",
  blocked: "Blocked",
  done: "Done",
};

// six ring positions on a 24x24 viewBox, clock-style starting at 12 o'clock,
// clockwise — a hexagon reads cleanly at 20px where 8+ dots start to smear.
const RING: ReadonlyArray<readonly [number, number]> = [
  [12, 4],
  [18.93, 8],
  [18.93, 16],
  [12, 20],
  [5.07, 16],
  [5.07, 8],
];

// Per-state resting opacity for the six ring dots. This is the shape a
// screen-off, motion-off viewer gets, so each row has to be legible as its
// state entirely on its own — not a coincidence of where a rotation stopped.
const RING_OPACITY: Record<BeaconCadenceState, readonly number[]> = {
  working: [1, 0.83, 0.66, 0.49, 0.32, 0.15], // decaying comet trail
  searching: [1, 0.7, 0.15, 0.15, 0.15, 0.15], // small bright beam cluster
  "awaiting-input": [0.22, 0.22, 0.22, 0.22, 0.22, 0.22], // even + dim, center carries it
  blocked: [0, 0.55, 0.55, 0.55, 0.55, 0.55], // one dot missing — the ring can't close
  done: [1, 1, 1, 1, 1, 1], // complete
};

const DOT_R = 1.7;

const CSS = `
.ns-bc-ring{transform-box:fill-box;transform-origin:center;}
.ns-bc-center{transform-box:fill-box;transform-origin:center;}
.ns-bc-check{transform-box:fill-box;transform-origin:center;}
.ns-bc-spin{animation:ns-bc-spin 1.2s linear infinite;}
.ns-bc-sweep{animation:ns-bc-sweep 1.7s cubic-bezier(.45,0,.55,1) infinite;}
.ns-bc-tremor{animation:ns-bc-tremor 1.5s steps(1) infinite;}
.ns-bc-pulse{animation:ns-bc-pulse 1.9s ease-in-out infinite;}
.ns-bc-settle{animation:ns-bc-settle .42s cubic-bezier(.34,1.56,.64,1) both;}
@keyframes ns-bc-spin{to{transform:rotate(360deg)}}
@keyframes ns-bc-sweep{
  0%,100%{transform:rotate(-35deg)}
  50%{transform:rotate(35deg)}
}
@keyframes ns-bc-tremor{
  0%,58%,100%{transform:rotate(0deg)}
  15%{transform:rotate(9deg)}
  30%{transform:rotate(-5deg)}
  44%{transform:rotate(3deg)}
}
@keyframes ns-bc-pulse{
  0%,100%{transform:scale(.8);opacity:.5}
  50%{transform:scale(1.22);opacity:1}
}
@keyframes ns-bc-settle{
  from{transform:scale(.5);opacity:0}
  to{transform:scale(1);opacity:1}
}
@media (prefers-reduced-motion: reduce){
  .ns-bc-spin,.ns-bc-sweep,.ns-bc-tremor,.ns-bc-pulse,.ns-bc-settle{animation:none;}
}
`;

const RING_ANIMATION_CLASS: Record<BeaconCadenceState, string> = {
  working: "ns-bc-spin",
  searching: "ns-bc-sweep",
  "awaiting-input": "",
  blocked: "ns-bc-tremor",
  done: "",
};

export interface BeaconCadenceProps {
  /** which cadence to render — the motion pattern IS the state, color never is */
  state: BeaconCadenceState;
  /** glyph size in px, meant to sit inline beside a text label. legible 20-64. */
  size?: number;
  /**
   * accessible text announced via the component's own aria-live region on
   * every state change (e.g. "Solving…"). Defaults to a plain state name.
   * If the consumer already renders a visible adjacent label that updates
   * with state, either pass that same string here (redundant but harmless
   * for sighted users) or aria-hide their own label to avoid a double
   * announcement — the glyph is the one guaranteed to announce transitions.
   */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function BeaconCadence({
  state,
  size = 24,
  label,
  className = "",
}: BeaconCadenceProps) {
  const opacities = RING_OPACITY[state];
  const ringClass = RING_ANIMATION_CLASS[state];

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <style>{CSS}</style>
      <svg
        key={state}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      >
        <g className={ringClass ? `ns-bc-ring ${ringClass}` : "ns-bc-ring"}>
          {RING.map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={DOT_R}
              style={{ fill: "var(--foreground)", opacity: opacities[i] }}
            />
          ))}
        </g>

        {state === "awaiting-input" && (
          <circle
            className="ns-bc-center ns-bc-pulse"
            cx={12}
            cy={12}
            r={2.8}
            style={{ fill: "var(--foreground)" }}
          />
        )}

        {state === "done" && (
          <path
            className="ns-bc-check"
            d="M8.3 12.4l2.5 2.5 4.9-5.4"
            fill="none"
            stroke="var(--foreground)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span className="sr-only">{label ?? STATE_LABEL[state]}</span>
    </span>
  );
}
