"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// RationRule — a quota meter with no bar, no fill, no pill: just the printed
// reading ('38.2 GB of 100 GB') sitting directly above a 4px-tall hairline.
// The rule itself IS the meter — its used portion is a solid --foreground
// stroke, its remainder a dashed --border stroke (2 3), and the boundary
// between them eases with the value. A fixed tick marks the warning
// threshold in --warning, never on the fill; crossing it doesn't turn
// anything red, it thickens the solid stroke 1px -> 2px and steps the
// numerals from weight 400 to 600 — the line asserts itself instead of
// alarming. Meant to sit dozens-deep on a settings page (storage, seats,
// API credits, budget) at text scale. Pure inline SVG + CSS, no canvas.
// ---------------------------------------------------------------------------

export interface RationRuleProps {
  /** what's being rationed, e.g. "Storage" — shown as a caption and used as the meter's accessible name */
  label: string;
  /** amount currently used */
  value: number;
  /** total allowance */
  max: number;
  /** short unit printed after both numbers, e.g. "GB" */
  unit: string;
  /** full unit word spoken by aria-valuetext, e.g. "gigabytes" — defaults to `unit` */
  unitLabel?: string;
  /** fraction of max (0-1) at which the rule crosses into warning weight */
  warning?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const VIEW_W = 400;
const VIEW_H = 6;
const RULE_Y = VIEW_H / 2;
const MOVE_MS = 350;

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
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

// eases `target` toward its resting value over `duration`ms with
// ease-out-expo, cleanly retargeting mid-flight from whatever the display
// value currently is. Snaps instantly when `reduced`.
function useEasedFraction(target: number, duration: number, reduced: boolean) {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const fromRef = useRef(target);
  const toRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      displayRef.current = target;
      fromRef.current = target;
      toRef.current = target;
      setDisplay(target);
      return;
    }
    if (target === toRef.current) return;
    fromRef.current = displayRef.current;
    toRef.current = target;
    startRef.current = performance.now();
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / duration);
      const eased = easeOutExpo(t);
      const next = fromRef.current + (toRef.current - fromRef.current) * eased;
      displayRef.current = next;
      setDisplay(next);
      rafRef.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, reduced]);

  return display;
}

export function RationRule({
  label,
  value,
  max,
  unit,
  unitLabel,
  warning = 0.8,
  className = "",
}: RationRuleProps) {
  const uid = useId();
  const reduced = useReducedMotion();

  const safeMax = max > 0 ? max : 1e-6;
  const targetFraction = clamp01(value / safeMax);
  const warningFraction = clamp01(warning);

  const displayFraction = useEasedFraction(targetFraction, MOVE_MS, reduced);

  // final rest-state crossing drives ARIA (never mid-animation dependent);
  // the visual stroke width/weight track the live animated position, so the
  // thickening visibly happens AT the tick as the boundary sweeps past it.
  const crossedFinal = targetFraction >= warningFraction;
  const crossedLive = displayFraction >= warningFraction;

  const boundaryX = displayFraction * VIEW_W;
  const tickX = warningFraction * VIEW_W;

  const usedText = fmt(value);
  const maxText = fmt(max);
  const resolvedUnitLabel = unitLabel || unit;
  const stateText = crossedFinal
    ? "at or above warning threshold"
    : "below warning threshold";
  const valueText =
    `${usedText} of ${maxText} ${resolvedUnitLabel}, ${stateText}`.replace(
      /\s+/g,
      " "
    );

  const labelId = `${uid}-label`;

  return (
    <div className={className}>
      <style>{`
.ns-ration-solid{transition:stroke-width 200ms cubic-bezier(0.22,1,0.36,1)}
.ns-ration-weight{transition:font-weight 200ms cubic-bezier(0.22,1,0.36,1)}
@media (prefers-reduced-motion: reduce){
  .ns-ration-solid{transition:none}
  .ns-ration-weight{transition:none}
}
`}</style>

      <span id={labelId} className="block font-mono text-[11px] tracking-wide text-ns-muted">
        {label.toUpperCase()}
      </span>

      <p
        className={
          "ns-ration-weight mt-1 text-sm tabular-nums text-foreground " +
          (crossedLive ? "font-semibold" : "font-normal")
        }
      >
        {usedText} {unit}{" "}
        <span className="text-ns-muted">
          of {maxText} {unit}
        </span>
      </p>

      <div
        role="meter"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        className="mt-1.5"
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="block h-1.5 w-full"
          aria-hidden
          focusable="false"
        >
          <line
            x1={boundaryX}
            y1={RULE_Y}
            x2={VIEW_W}
            y2={RULE_Y}
            vectorEffect="non-scaling-stroke"
            strokeWidth={1}
            strokeDasharray="2 3"
            strokeLinecap="butt"
            className="stroke-current text-border"
          />
          <line
            x1={0}
            y1={RULE_Y}
            x2={boundaryX}
            y2={RULE_Y}
            vectorEffect="non-scaling-stroke"
            strokeWidth={crossedLive ? 2 : 1}
            strokeLinecap="butt"
            className="ns-ration-solid stroke-current text-foreground"
          />
          <line
            x1={tickX}
            y1={0}
            x2={tickX}
            y2={VIEW_H}
            vectorEffect="non-scaling-stroke"
            strokeWidth={1}
            style={{ stroke: "var(--warning, #f5a623)" }}
          />
        </svg>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {valueText}
      </p>
    </div>
  );
}
