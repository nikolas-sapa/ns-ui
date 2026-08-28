"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SemaphoreArmTension — a status control drawn as a UK lower-quadrant
// mechanical semaphore. Gravity holds the arm at Danger (horizontal); it
// only reaches Clear (rotated down toward the track) when the signal wire
// running back to a box is under tension. Position is the only state
// carrier — there is no coloured spectacle glass here, deliberately: the
// lamp behind the arm is a fixed-hue luminance source, never a red/green
// swap, so the whole thing stays legible in value alone.
//
// Two independent continuous motions make it alive at rest without ever
// touching the arm's actual Danger/Clear state:
//   - a slow sinusoidal "wire tension" bob (9s period) nudges the arm a
//     couple of degrees either side of its resting angle and rocks the
//     counterweight a few px in the opposite phase, standing in for the
//     real signal wire's continuous give under thermal length change;
//   - a 12Hz-sampled, linearly-interpolated luminance flicker on the lamp
//     glow, standing in for a real oil flame's slow candle-like drift.
// Both run on one rAF loop, writing directly to SVG attributes via refs —
// no React re-render per frame. A discrete click/keyboard toggle instead
// animates the resting angle itself from its current value to the new
// target with a manual back-ease overshoot (no CSS transition, since the
// same rotate attribute is already being written every frame by the bob).
//
// prefers-reduced-motion stops the rAF loop entirely (no bob, no flicker,
// no overshoot on toggle — a plain instant angle change instead) but never
// overrides which state the arm is actually in; a live Danger status stays
// visibly Danger under reduced motion. What the frozen ambient loop settles
// on is a matter for the caller's default state, not this component's
// internal override.
// ---------------------------------------------------------------------------

export interface SemaphoreArmTensionProps {
  /** controlled state; omit for uncontrolled */
  cleared?: boolean;
  /** uncontrolled initial state. Default false (Danger). */
  defaultCleared?: boolean;
  /** called with the new state after a toggle */
  onClearedChange?: (cleared: boolean) => void;
  /** label shown above the readout, e.g. "Deploy — checkout-service" */
  label?: string;
  /** whether the control responds to click/keyboard, or is a read-only status display */
  interactive?: boolean;
  /** accessible name override; falls back to a generated Danger/Clear description */
  "aria-label"?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const VIEW_W = 200;
const VIEW_H = 240;

const POST_X = 68;
const POST_TOP_Y = 40; // pivot height
const POST_BOTTOM_Y = 222;
const ARM_LEN = 82;
const ARM_THICK = 7;
const LAMP_CX = POST_X;
const LAMP_CY = POST_TOP_Y - 2;
const LAMP_R = 13;
const WEIGHT_LINK_Y0 = POST_TOP_Y + 92;
const WEIGHT_LINK_LEN = 26;
const WEIGHT_R = 9;

const DANGER_DEG = 0; // arm horizontal — gravity's resting position
const CLEAR_DEG = 55; // arm rotated down toward the track (SVG clockwise = down)

const WIRE_PERIOD_MS = 9000; // ambient wire-tension breathing cycle
const ARM_BOB_DEG = 2.2; // ambient rotation nudge either side of rest
const WEIGHT_BOB_PX = 4; // ambient counterweight travel, opposite phase

const LAMP_SAMPLE_MS = 1000 / 12; // 12Hz luminance sample rate
const LAMP_MIN = 0.82;
const LAMP_MAX = 1.0;

const TOGGLE_MS = 650;

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// standard "back out" ease — overshoots past 1 before settling, the same
// family of curve the codebase already uses (cubic-bezier(0.34,1.56,0.64,1))
// for a mechanical snap-and-settle, computed by hand here because the same
// rotate attribute is written every rAF frame by the ambient bob and can't
// also be driven by a CSS transition without the two fighting each other.
function backOut(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function SemaphoreArmTension({
  cleared,
  defaultCleared = false,
  onClearedChange,
  label = "Signal",
  interactive = true,
  "aria-label": ariaLabelProp,
  className = "",
}: SemaphoreArmTensionProps) {
  const uid = useId();
  const reduced = useReducedMotion();

  const [uncontrolled, setUncontrolled] = useState(defaultCleared);
  const isControlled = cleared !== undefined;
  const value = isControlled ? cleared : uncontrolled;

  const armRef = useRef<SVGGElement | null>(null);
  const weightRef = useRef<SVGGElement | null>(null);
  const lampGlowRef = useRef<SVGCircleElement | null>(null);

  // toggle-animation state lives in refs — it drives per-frame writes, not
  // React re-renders
  const currentAngleRef = useRef(defaultCleared ? CLEAR_DEG : DANGER_DEG);
  const toggleFromRef = useRef(currentAngleRef.current);
  const toggleToRef = useRef(currentAngleRef.current);
  const toggleStartRef = useRef(0);
  const togglingRef = useRef(false);

  const randRef = useRef(mulberry32(0x5e6a91));
  const lampCurrentRef = useRef(0.5);
  const lampNextRef = useRef(0.5);
  const lampSampleAtRef = useRef(0);

  // reflect an external/controlled `value` change into the target angle —
  // this is the ONLY place the actual Danger/Clear state changes; the
  // ambient bob never touches it.
  useEffect(() => {
    const target = value ? CLEAR_DEG : DANGER_DEG;
    if (reduced) {
      currentAngleRef.current = target;
      togglingRef.current = false;
      if (armRef.current) armRef.current.setAttribute("transform", `translate(${POST_X} ${POST_TOP_Y}) rotate(${target})`);
      if (weightRef.current) weightRef.current.setAttribute("transform", "translate(0 0)");
      if (lampGlowRef.current) lampGlowRef.current.setAttribute("opacity", String(LAMP_MAX));
      return;
    }
    toggleFromRef.current = currentAngleRef.current;
    toggleToRef.current = target;
    toggleStartRef.current = 0; // set on next rAF tick
    togglingRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);

  useEffect(() => {
    if (reduced) return; // no ambient loop under reduced motion — frame is static
    let raf = 0;
    let visible = true;

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;

      // -- discrete toggle: back-ease overshoot from the previous resting
      // angle to the new one --------------------------------------------
      let baseAngle = currentAngleRef.current;
      if (togglingRef.current) {
        if (toggleStartRef.current === 0) toggleStartRef.current = now;
        const p = clamp01((now - toggleStartRef.current) / TOGGLE_MS);
        const eased = backOut(p);
        baseAngle = lerp(toggleFromRef.current, toggleToRef.current, eased);
        if (p >= 1) {
          togglingRef.current = false;
          baseAngle = toggleToRef.current;
        }
        currentAngleRef.current = baseAngle;
      }

      // -- ambient wire-tension breathing ---------------------------------
      const phase = ((now % WIRE_PERIOD_MS) / WIRE_PERIOD_MS) * Math.PI * 2;
      const bob = Math.sin(phase);
      const armAngle = baseAngle + bob * ARM_BOB_DEG;
      const weightY = -bob * WEIGHT_BOB_PX;

      if (armRef.current) {
        armRef.current.setAttribute("transform", `translate(${POST_X} ${POST_TOP_Y}) rotate(${armAngle.toFixed(2)})`);
      }
      if (weightRef.current) {
        weightRef.current.setAttribute("transform", `translate(0 ${weightY.toFixed(2)})`);
      }

      // -- 12Hz-sampled lamp flicker, linearly interpolated between
      // samples so it drifts rather than strobes -------------------------
      if (now - lampSampleAtRef.current >= LAMP_SAMPLE_MS) {
        lampCurrentRef.current = lampNextRef.current;
        lampNextRef.current = randRef.current();
        lampSampleAtRef.current = now;
      }
      const flickerT = clamp01((now - lampSampleAtRef.current) / LAMP_SAMPLE_MS);
      const lum = lerp(lampCurrentRef.current, lampNextRef.current, flickerT);
      if (lampGlowRef.current) {
        lampGlowRef.current.setAttribute("opacity", (LAMP_MIN + (LAMP_MAX - LAMP_MIN) * lum).toFixed(3));
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      if (visible && !raf) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  const toggle = useCallback(() => {
    if (!interactive) return;
    const next = !value;
    if (!isControlled) setUncontrolled(next);
    onClearedChange?.(next);
  }, [interactive, isControlled, onClearedChange, value]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!interactive) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    },
    [interactive, toggle]
  );

  const stateWord = value ? "CLEAR" : "DANGER";
  const labelId = `${uid}-label`;
  const descId = `${uid}-desc`;
  const description = value
    ? "Clear — wire under tension, arm lowered."
    : "Danger — wire slack, arm at rest by gravity.";
  const accessibleLabel = ariaLabelProp ?? `${label}: ${stateWord.toLowerCase()}`;
  const rootClassName =
    "mt-3 block w-full rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent " +
    (interactive ? "cursor-pointer" : "");

  const svgContent = (
    <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-[240px] w-full"
          aria-hidden
          focusable="false"
        >
          {/* post */}
          <line
            x1={POST_X}
            y1={POST_TOP_Y}
            x2={POST_X}
            y2={POST_BOTTOM_Y}
            className="stroke-current text-foreground"
            strokeWidth={4}
            strokeLinecap="round"
          />
          {/* ground line */}
          <line
            x1={POST_X - 40}
            y1={POST_BOTTOM_Y}
            x2={POST_X + 40}
            y2={POST_BOTTOM_Y}
            className="stroke-current text-border"
            strokeWidth={2}
          />

          {/* counterweight link + weight — rides the ambient bob opposite the arm */}
          <g ref={weightRef}>
            <line
              x1={POST_X}
              y1={WEIGHT_LINK_Y0}
              x2={POST_X}
              y2={WEIGHT_LINK_Y0 + WEIGHT_LINK_LEN}
              className="stroke-current text-ns-muted"
              strokeWidth={2}
            />
            <circle
              cx={POST_X}
              cy={WEIGHT_LINK_Y0 + WEIGHT_LINK_LEN + WEIGHT_R}
              r={WEIGHT_R}
              className="fill-current text-ns-muted"
            />
          </g>

          {/* lamp housing — fixed luminance source, never a coloured aspect */}
          <circle
            cx={LAMP_CX}
            cy={LAMP_CY}
            r={LAMP_R}
            className="fill-current text-background"
          />
          <circle
            cx={LAMP_CX}
            cy={LAMP_CY}
            r={LAMP_R}
            className="stroke-current text-border"
            strokeWidth={2}
            fill="none"
          />
          <circle
            ref={lampGlowRef}
            cx={LAMP_CX}
            cy={LAMP_CY}
            r={LAMP_R - 5}
            className="fill-current text-foreground"
            opacity={value ? LAMP_MAX : LAMP_MIN}
          />

          {/* arm — pivots at the post top; rotation IS the state */}
          <g ref={armRef} transform={`translate(${POST_X} ${POST_TOP_Y}) rotate(${defaultCleared ? CLEAR_DEG : DANGER_DEG})`}>
            <rect
              x={0}
              y={-ARM_THICK / 2}
              width={ARM_LEN}
              height={ARM_THICK}
              rx={2}
              className="fill-current text-foreground"
            />
            {/* tip stripe — the fixed reference mark a viewer tracks for the bob */}
            <rect
              x={ARM_LEN - 14}
              y={-ARM_THICK / 2}
              width={6}
              height={ARM_THICK}
              className="fill-current text-background"
              opacity={0.5}
            />
          </g>

          {/* pivot bolt */}
          <circle cx={POST_X} cy={POST_TOP_Y} r={3.5} className="fill-current text-foreground" />
        </svg>
  );

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="font-mono text-[11px] tracking-wide text-ns-muted">
          {label.toUpperCase()}
        </span>
        <span className="font-mono text-[11px] font-semibold tracking-wide text-foreground">
          {stateWord}
        </span>
      </div>
      <span id={descId} className="sr-only">
        {description}
      </span>

      {interactive ? (
        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-labelledby={labelId}
          aria-describedby={descId}
          aria-label={accessibleLabel}
          onClick={toggle}
          onKeyDown={onKeyDown}
          className={rootClassName}
        >
          {svgContent}
        </button>
      ) : (
        <div role="status" aria-labelledby={labelId} aria-describedby={descId} className={rootClassName}>
          {svgContent}
        </div>
      )}
    </div>
  );
}
