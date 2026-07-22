"use client";

import { useEffect, useId, useState } from "react";

// ---------------------------------------------------------------------------
// FeelerGap — a machinist's go/no-go gauge for threshold status. A chip sized
// to the live value eases toward a slot (two jaws) sized to the limit, both
// widths drawn on the same scale: the slot's opening is fixed at GAP_PX and
// always represents `limit`, so the chip's width relative to it literally IS
// value/limit. If the chip fits it centers inside the jaws with the leftover
// span visible as daylight on both sides — the clearance. If it doesn't fit
// it can only push in as far as the far jaw, arriving compressed 2px with
// the excess width left protruding out past the near jaw (partially hidden
// behind its body), then shudders on a decaying 3-swing wiggle. Pass/fail is
// never carried by the jam alone — a Geist Mono CLEAR/OVER token sits next
// to the reading at rest either way. Pure SVG + CSS transition/keyframes, no
// canvas; every shape is stroke/fill "currentColor" tinted by a token text
// color class (text-foreground / text-muted / text-border), so both themes
// restyle for free with zero numeric color reads.
// ---------------------------------------------------------------------------

export interface FeelerGapProps {
  /** the live measured quantity, e.g. a bundle's byte size */
  value: number;
  /** the tolerance/budget/SLA the value is checked against */
  limit: number;
  /** short unit suffix used in every label and the mono readouts, e.g. "KB" */
  unit?: string;
  /** what's being measured, shown above the gauge, e.g. "Bundle size" */
  label?: string;
  className?: string;
}

// slot geometry — GAP_PX is fixed and always *is* the limit on-scale; the
// chip's width is derived from value at the same px-per-unit, so the ratio
// of the two rendered widths is exactly value/limit regardless of unit.
const VIEW_W = 360;
const VIEW_H = 100;
const TRACK_TOP = 18;
const TRACK_H = 64;
const CENTER_Y = TRACK_TOP + TRACK_H / 2;
const JAW_W = 18;
const GAP_PX = 64;
const GAP_CENTER_X = 210;
const GAP_LEFT = GAP_CENTER_X - GAP_PX / 2; // near jaw's inner face
const GAP_RIGHT = GAP_CENTER_X + GAP_PX / 2; // far jaw's inner face
const CHIP_H = 40;
const CHIP_Y = CENTER_Y - CHIP_H / 2;
const MIN_CHIP_PX = 6; // a near-zero value still reads as a sliver, not nothing
const MAX_OVERSHOOT_PX = 140; // caps rendering so an extreme jam stays on canvas
const COMPRESS_PX = 2; // the "compresses 2px" squeeze baked into the jam rest width
const MOVE_MS = 650; // ease-out-expo travel duration, mirrored by the JS shudder timer

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

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (Number.isInteger(n) || abs >= 100) return Math.round(n).toString();
  return n.toFixed(1);
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function JamGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
      <path
        d="M8 2.5v6M8 11.2v.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FeelerGap({
  value,
  limit,
  unit = "",
  label = "Value",
  className = "",
}: FeelerGapProps) {
  const uid = useId();
  const reduced = useReducedMotion();
  const [shudderTick, setShudderTick] = useState(0);

  const safeLimit = limit > 0 ? limit : 1e-6;
  const pxPerUnit = GAP_PX / safeLimit;
  const over = value > limit;
  const clearance = limit - value; // positive when clear, negative when over
  const rawChipPx = Math.max(0, value) * pxPerUnit;

  let chipPx: number;
  let chipX: number;
  if (!over) {
    chipPx = Math.max(rawChipPx, MIN_CHIP_PX);
    chipX = GAP_CENTER_X - chipPx / 2; // centered in the mouth, daylight both sides
  } else {
    const overshootRaw = rawChipPx - GAP_PX;
    const overshootDisplay = Math.min(overshootRaw, MAX_OVERSHOOT_PX);
    chipPx = GAP_PX + overshootDisplay - COMPRESS_PX;
    chipX = GAP_RIGHT - chipPx; // right edge stays flush at the far jaw
  }

  // replay the damped shudder every time a new value settles into a jam —
  // fires on mount too, so an initially-over-limit gauge demonstrates itself.
  // Skipped entirely under reduced motion: no jam wiggle, final position only.
  useEffect(() => {
    if (!over || reduced) return;
    const t = setTimeout(() => setShudderTick((k) => k + 1), MOVE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, limit, over, reduced]);

  const overshootText = fmt(Math.max(0, -clearance));
  const clearanceText = fmt(Math.max(0, clearance));
  const valueText = over
    ? `${fmt(value)} ${unit} of ${fmt(limit)} ${unit} budget, ${overshootText} ${unit} over`.replace(
        /\s+/g,
        " "
      )
    : `${fmt(value)} ${unit} of ${fmt(limit)} ${unit} budget, ${clearanceText} ${unit} clearance`.replace(
        /\s+/g,
        " "
      );

  const labelId = `${uid}-label`;

  return (
    <div className={className}>
      <style>{`
.ns-feeler-chip{transition:x ${MOVE_MS}ms cubic-bezier(0.16,1,0.3,1),width ${MOVE_MS}ms cubic-bezier(0.16,1,0.3,1)}
@keyframes ns-feeler-shudder{
  0%{transform:translateX(0)}
  15%{transform:translateX(-3px)}
  32%{transform:translateX(2.2px)}
  50%{transform:translateX(-1.4px)}
  68%{transform:translateX(0.8px)}
  84%{transform:translateX(-0.3px)}
  100%{transform:translateX(0)}
}
.ns-feeler-shudder{animation:ns-feeler-shudder 480ms cubic-bezier(0.22,1,0.36,1) 1}
@media (prefers-reduced-motion: reduce){
  .ns-feeler-chip{transition:none}
  .ns-feeler-shudder{animation:none}
}
`}</style>

      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="font-mono text-[11px] tracking-wide text-muted">
          {label.toUpperCase()}
        </span>
        <span
          className={
            "inline-flex items-center gap-1 font-mono text-[11px] tracking-wide text-foreground " +
            (over ? "font-semibold" : "")
          }
        >
          {over ? <JamGlyph /> : <CheckGlyph />}
          {over ? "OVER" : "CLEAR"}
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums text-foreground">
          {fmt(value)}
        </span>
        <span className="font-mono text-xs text-muted">
          / {fmt(limit)} {unit}
        </span>
      </div>

      <div
        role="meter"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={value}
        aria-valuetext={valueText}
        className="mt-3"
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-[70px] w-full"
          aria-hidden
          focusable="false"
        >
          {/* chip — painted under the jaws in z-order, so any portion that
              overlaps a jaw body (the un-swallowed overshoot when jammed) is
              occluded there and only the true protruding stub reads visible */}
          <g
            key={shudderTick}
            className={over && !reduced ? "ns-feeler-shudder" : undefined}
          >
            <rect
              x={chipX}
              y={CHIP_Y}
              width={chipPx}
              height={CHIP_H}
              rx={2}
              className="ns-feeler-chip fill-current text-foreground"
            />
          </g>

          {/* near jaw — body + inner-face boundary tick */}
          <rect
            x={GAP_LEFT - JAW_W}
            y={TRACK_TOP}
            width={JAW_W}
            height={TRACK_H}
            rx={3}
            className="fill-current text-muted"
          />
          <line
            x1={GAP_LEFT}
            x2={GAP_LEFT}
            y1={TRACK_TOP - 4}
            y2={TRACK_TOP + TRACK_H + 4}
            className="stroke-current text-border"
            strokeWidth={1}
          />

          {/* far jaw — body + inner-face boundary tick */}
          <rect
            x={GAP_RIGHT}
            y={TRACK_TOP}
            width={JAW_W}
            height={TRACK_H}
            rx={3}
            className="fill-current text-muted"
          />
          <line
            x1={GAP_RIGHT}
            x2={GAP_RIGHT}
            y1={TRACK_TOP - 4}
            y2={TRACK_TOP + TRACK_H + 4}
            className="stroke-current text-border"
            strokeWidth={1}
          />
        </svg>
      </div>

      <p className="mt-2 font-mono text-xs text-muted">
        {over ? `${overshootText} ${unit} over` : `${clearanceText} ${unit} clear`}
      </p>

      <p role="status" aria-live="polite" className="sr-only">
        {valueText}
      </p>
    </div>
  );
}
