"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// LevelBubble — a spirit level for a value against its target. A slim
// full-radius capsule outlined in --border holds two hairline tolerance
// ticks and a 10px ring (--foreground stroke, transparent fill — an air
// bubble, not a dot) that floats along the capsule to show signed deviation
// from `target`. Dead center is on target; the ticks mark the tolerance
// band. The bubble's x position is driven by a hand-rolled underdamped
// spring (stiffness 180, damping 14, mass 1) integrated on a direct-DOM rAF
// loop — no React state on the hot path — so live data makes it overshoot
// and settle instead of teleporting. Whether the reading is "outside
// tolerance" is derived straight from props (value, target, tolerance),
// never from the animated position, so a transient spring overshoot never
// flickers the capsule border or the printed weight on its own; only a real
// out-of-band value does. Outside tolerance the bubble can only press up to
// the capsule's inner wall (clamped, never escapes the shape), the printed
// deviation steps to font-weight 600, and the capsule's own stroke doubles.
// The two tolerance ticks are the one place --warning is allowed to appear;
// the bubble ring and capsule fill never touch it. Pure DOM + SVG + CSS, no
// canvas. Differs from reed-vu (unsigned live loudness) and
// tide-gauge-password (a filling reservoir toward a maximum): this measures
// a SIGNED deviation from a two-sided target band, answering "how far off,
// and which way" — a question neither of those meters asks.
// ---------------------------------------------------------------------------

export interface LevelBubbleProps {
  /** what's being tracked against its target, e.g. "Error budget burn" */
  label: string;
  /** the live measured quantity */
  value: number;
  /** the target value — dead center on the capsule */
  target: number;
  /** half-width of the tolerance band, in the same units as value/target */
  tolerance: number;
  /**
   * deviation magnitude at which the bubble presses fully against the
   * capsule end. Defaults to 3x tolerance, so the tolerance ticks sit
   * comfortably inside the track rather than at its very edge.
   */
  range?: number;
  /** short unit suffix printed with the deviation, e.g. "%", "°F" */
  unit?: string;
  /** full unit word spoken by aria-valuetext, e.g. "percent" — defaults to `unit` */
  unitLabel?: string;
  className?: string;
}

const VIEW_W = 280;
const VIEW_H = 32;
const CAP_X0 = 6;
const CAP_X1 = VIEW_W - 6;
const CAP_Y0 = 8;
const CAP_Y1 = 24;
const CAP_RX = (CAP_Y1 - CAP_Y0) / 2; // 8 — full radius for a 16px-tall capsule
const CENTER_X = VIEW_W / 2;
const CENTER_Y = (CAP_Y0 + CAP_Y1) / 2;
const BUBBLE_R = 5;
const TRACK_MARGIN = 13; // keeps the bubble's ring fully inside the capsule wall at full deflection
const HALF_TRACK = CENTER_X - CAP_X0 - TRACK_MARGIN;
const STROKE_IN = 1.5;
const STROKE_OUT = 3;
const TICK_Y0 = CAP_Y0 - 3;
const TICK_Y1 = CAP_Y1 + 3;

const SPRING_K = 180;
const SPRING_C = 14;
const SETTLE_EPS_X = 0.05;
const SETTLE_EPS_V = 2;
const MAX_DT = 0.032;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function fmt1(n: number) {
  if (!Number.isFinite(n)) return "0.0";
  return (Math.round(n * 10) / 10).toFixed(1);
}

function directionWord(deviation: number) {
  if (deviation > 0) return "over";
  if (deviation < 0) return "under";
  return "at";
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

export function LevelBubble({
  label,
  value,
  target,
  tolerance,
  range,
  unit = "%",
  unitLabel,
  className = "",
}: LevelBubbleProps) {
  const uid = useId();
  const reduced = useReducedMotion();

  const deviation = value - target;
  const safeTolerance = tolerance > 0 ? tolerance : 1e-6;
  const effectiveRange = range && range > 0 ? range : safeTolerance * 3;
  const outside = Math.abs(deviation) > safeTolerance;

  const normalized = clamp(deviation / effectiveRange, -1, 1);
  const targetX = CENTER_X + normalized * HALF_TRACK;
  const tickOffset = clamp(safeTolerance / effectiveRange, 0, 1) * HALF_TRACK;

  const bubbleRef = useRef<SVGCircleElement>(null);
  const xRef = useRef(targetX);
  const vRef = useRef(0);
  const targetXRef = useRef(targetX);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const prevOutsideRef = useRef(outside);
  const [announce, setAnnounce] = useState("");

  const resolvedUnitLabel = unitLabel || unit;
  const absDevText = fmt1(Math.abs(deviation));
  const valueText =
    deviation === 0
      ? `on target, within tolerance`
      : `${absDevText} ${resolvedUnitLabel} ${directionWord(deviation)} target, ${
          outside ? "outside tolerance" : "within tolerance"
        }`.replace(/\s+/g, " ");

  const applyX = (x: number) => {
    const el = bubbleRef.current;
    if (!el) return;
    el.style.transform = `translateX(${(x - CENTER_X).toFixed(2)}px)`;
  };

  const loop = (now: number) => {
    const last = lastRef.current || now;
    const dt = Math.min((now - last) / 1000, MAX_DT);
    lastRef.current = now;

    const tgt = targetXRef.current;
    const dx = xRef.current - tgt;
    const ax = -SPRING_K * dx - SPRING_C * vRef.current;
    vRef.current += ax * dt;
    xRef.current += vRef.current * dt;
    applyX(xRef.current);

    if (Math.abs(xRef.current - tgt) < SETTLE_EPS_X && Math.abs(vRef.current) < SETTLE_EPS_V) {
      xRef.current = tgt;
      vRef.current = 0;
      applyX(tgt);
      rafRef.current = null;
      lastRef.current = 0;
      return;
    }
    rafRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    targetXRef.current = targetX;

    if (reduced) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastRef.current = 0;
      vRef.current = 0;
      xRef.current = targetX;
      applyX(targetX);
      return;
    }

    if (rafRef.current === null) {
      lastRef.current = 0;
      rafRef.current = requestAnimationFrame(loop);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetX, reduced]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // out-of-band transitions announce once via a polite live region — the
  // meter's own aria-valuetext already updates continuously and would spam
  // if it were the live channel too.
  useEffect(() => {
    if (prevOutsideRef.current !== outside) {
      prevOutsideRef.current = outside;
      setAnnounce(`${label}: ${valueText}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outside]);

  const labelId = `${uid}-label`;
  const sign = deviation > 0 ? "+" : "";
  const printedDeviation = `${sign}${fmt1(deviation)}${unit}`;

  return (
    <div className={className}>
      <style>{`
.ns-level-bubble-ring{transition:none}
@media (prefers-reduced-motion: reduce){
  .ns-level-bubble-ring{transition:transform 100ms linear}
}
`}</style>

      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span id={labelId} className="font-mono text-[11px] uppercase tracking-wide text-muted">
          {label}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-muted">
          target {fmt1(target)}
          {unit}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div
          role="meter"
          aria-labelledby={labelId}
          aria-valuemin={target - effectiveRange}
          aria-valuemax={target + effectiveRange}
          aria-valuenow={value}
          aria-valuetext={valueText}
          className="min-w-0 flex-1"
        >
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-8 w-full" aria-hidden focusable="false">
            <rect
              x={CAP_X0}
              y={CAP_Y0}
              width={CAP_X1 - CAP_X0}
              height={CAP_Y1 - CAP_Y0}
              rx={CAP_RX}
              fill="none"
              strokeWidth={outside ? STROKE_OUT : STROKE_IN}
              className="stroke-current text-border transition-[stroke-width] duration-200"
            />

            <line
              x1={CENTER_X - tickOffset}
              x2={CENTER_X - tickOffset}
              y1={TICK_Y0}
              y2={TICK_Y1}
              strokeWidth={1}
              style={{ stroke: "var(--warning, #f5a623)" }}
            />
            <line
              x1={CENTER_X + tickOffset}
              x2={CENTER_X + tickOffset}
              y1={TICK_Y0}
              y2={TICK_Y1}
              strokeWidth={1}
              style={{ stroke: "var(--warning, #f5a623)" }}
            />

            <circle
              ref={bubbleRef}
              className="ns-level-bubble-ring stroke-current text-foreground"
              cx={CENTER_X}
              cy={CENTER_Y}
              r={BUBBLE_R}
              fill="none"
              strokeWidth={1.5}
              style={{ transform: `translateX(${(xRef.current - CENTER_X).toFixed(2)}px)` }}
            />
          </svg>
        </div>

        <span
          className={
            "shrink-0 font-mono text-sm tabular-nums text-foreground " +
            (outside ? "font-semibold" : "font-normal")
          }
        >
          {printedDeviation}
        </span>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
