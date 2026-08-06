"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// BimetalTrip — a data-driven threshold indicator built like a thermostat's
// bimetallic strip. One SVG quadratic-bezier path is fixed at two mounting
// posts; only its control point moves, offset upward as `value` climbs
// toward `tripAt` — straight at the bottom of the range, closing in on (but
// deliberately never quite touching) the contact pad as it nears the trip
// point, so there is always a real gap left for the latch to snap shut. That
// crossing LATCHES: the strip stays pinned at full bow (heavier --foreground
// stroke, filled contact pad — never
// --ns-accent, latching is data state, not interaction) regardless of value
// wobbling anywhere between `clearAt` and `tripAt`. It only relaxes back
// once value falls below `clearAt`, the lower re-arm mark — that gap between
// where it trips and where it clears is hysteresis made visible, not implied
// by a color. The snap into contact is a 320ms CSS `d`-transition on a
// back-out curve (~12% overshoot, no JS spring loop); the re-arm relax is a
// slow 600ms ease-out-expo settle; ordinary climbing between ticks gets a
// quick, non-overshooting ease. A muted hairline band under the strip spans
// clearAt..tripAt on the same x-domain as the strip's own mounts, with a
// live position marker and Geist Mono 'clears N / trips N' captions, so the
// two thresholds are legible from a single still frame. Every stroke/fill is
// a token class (text-foreground/text-ns-muted/text-border) — no hex, no
// canvas. DOM+SVG+CSS only.
// ---------------------------------------------------------------------------

export interface BimetalTripProps {
  /** the live metric being watched */
  value: number;
  /** the upper threshold — crossing it latches the strip against the contact */
  tripAt: number;
  /** the lower re-arm mark — the strip only relaxes once value falls below this */
  clearAt: number;
  /** domain floor for the visual scale (default 0) */
  min?: number;
  /** domain ceiling for the visual scale (default 100) */
  max?: number;
  /** unit suffix for readouts, e.g. "%", "ms", "req/s" (default "%") */
  unit?: string;
  /** what's being watched, shown above the strip, e.g. "CPU temp" */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

// geometry, SVG viewBox units
const VIEW_W = 320;
const VIEW_H = 150;
const ANCHOR_L_X = 40;
const ANCHOR_R_X = 280;
const MID_X = (ANCHOR_L_X + ANCHOR_R_X) / 2;
const BASE_Y = 62;
const MAX_CONTROL_OFFSET = 46; // control-point y-offset at full bow (bowFrac 1)
const PEAK_OFFSET = MAX_CONTROL_OFFSET / 2; // a quadratic's true peak sits at half the control offset
const CONTACT_Y = BASE_Y - PEAK_OFFSET; // where the strip's tip meets the pad, fully latched
const POST_TOP_Y = CONTACT_Y - 18;
const PAD_W = 16;
const PAD_H = 5;
const BAND_Y = 112;
const BAND_H = 6;
const TICK_H = 10;
// the unlatched approach curve's ceiling — kept below 1 (full/latched bow) so
// there is always a real geometric gap left against the contact pad for the
// latch's snap to close; see the bowFrac comment below for why this matters.
const UNLATCHED_BOW_CEILING = 0.75;

type TransitionKind = "climb" | "snap" | "rearm";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (Number.isInteger(n) || abs >= 100) return Math.round(n).toString();
  return n.toFixed(1);
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

function transitionStyle(kind: TransitionKind, reduced: boolean) {
  if (reduced) return { transitionDuration: "0ms" };
  if (kind === "snap") {
    return {
      transitionDuration: "320ms",
      transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    };
  }
  if (kind === "rearm") {
    return {
      transitionDuration: "600ms",
      transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    };
  }
  return {
    transitionDuration: "260ms",
    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
  };
}

export function BimetalTrip({
  value,
  tripAt,
  clearAt,
  min = 0,
  max = 100,
  unit = "%",
  label = "Threshold",
  className = "",
}: BimetalTripProps) {
  const uid = useId();
  const reduced = useReducedMotion();

  // latched is derived data state, initialized once from the mounting value
  // so a demo/dashboard that mounts already past tripAt renders latched with
  // no spurious snap animation on first paint.
  const [latched, setLatched] = useState(() => value >= tripAt);
  const [transitionKind, setTransitionKind] = useState<TransitionKind>("climb");
  const [announce, setAnnounce] = useState("");
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (!latched && value >= tripAt) {
      setLatched(true);
      setTransitionKind("snap");
      setAnnounce(
        `Latched — ${fmt(value)}${unit} crossed trip at ${fmt(tripAt)}${unit}. Holds until it falls below ${fmt(clearAt)}${unit}.`
      );
    } else if (latched && value < clearAt) {
      setLatched(false);
      setTransitionKind("rearm");
      setAnnounce(`Re-armed — ${fmt(value)}${unit} fell below clear mark ${fmt(clearAt)}${unit}.`);
    } else {
      setTransitionKind("climb");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, tripAt, clearAt]);

  // BUG FIX: bowFrac must never let the *unlatched* approach curve reach the
  // same numeric value as the *latched* pinned bow (1). It used to — clamp()
  // saturated the unlatched formula to exactly 1 the instant value reached
  // tripAt, which is the same value the latch pins to, so by the time the
  // `latched` effect actually flipped (one tick later) the path's `d` hadn't
  // changed at all: no delta for the CSS transition to animate, so the
  // signature 320ms back-out "snap into contact" never played — the strip
  // just silently arrived already fully bowed. Capping the unlatched
  // approach short of 1 keeps a real, persistent gap against the contact pad
  // (matching "closes a visible gap" below) so crossing tripAt always leaves
  // genuine distance for the snap to close, regardless of step size.
  const safeTripAt = tripAt > min ? tripAt : min + 1e-6;
  const approachFrac = clamp((value - min) / (safeTripAt - min), 0, 1);
  const bowFrac = latched ? 1 : approachFrac * UNLATCHED_BOW_CEILING;
  const controlY = BASE_Y - bowFrac * MAX_CONTROL_OFFSET;
  const stripD = `M ${ANCHOR_L_X} ${BASE_Y} Q ${MID_X} ${controlY} ${ANCHOR_R_X} ${BASE_Y}`;
  const stripStyle = transitionStyle(transitionKind, reduced);

  const domain = Math.max(1e-6, max - min);
  const xFor = (v: number) => ANCHOR_L_X + (clamp(v, min, max) - min) / domain * (ANCHOR_R_X - ANCHOR_L_X);
  const xClear = xFor(clearAt);
  const xTrip = xFor(tripAt);
  const xValue = xFor(value);

  const labelId = `${uid}-label`;
  const descId = `${uid}-desc`;
  const liveId = `${uid}-live`;
  const valueText = `${fmt(value)}${unit}, ${latched ? "latched" : "clear"}, trips at ${fmt(tripAt)}${unit}, clears at ${fmt(clearAt)}${unit}`;
  const stateWord = latched ? "LATCHED" : "CLEAR";
  const description = latched
    ? `Latched at ${fmt(value)}${unit} — trips at ${fmt(tripAt)}${unit}, will re-arm below ${fmt(clearAt)}${unit}.`
    : `Clear at ${fmt(value)}${unit} — trips at ${fmt(tripAt)}${unit}, clears at ${fmt(clearAt)}${unit}.`;

  return (
    <div className={className}>
      <style>{`
.ns-bimetal-strip{transition-property:d}
@media (prefers-reduced-motion: reduce){
  .ns-bimetal-strip{transition:none !important}
}
`}</style>

      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="font-mono text-[11px] tracking-wide text-ns-muted">
          {label.toUpperCase()}
        </span>
        <span
          className={
            "font-mono text-[11px] tracking-wide text-foreground " +
            (latched ? "font-semibold" : "")
          }
        >
          {stateWord}
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums text-foreground">
          {fmt(value)}
          {unit}
        </span>
      </div>

      <div
        role="meter"
        aria-labelledby={labelId}
        aria-describedby={descId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamp(value, min, max)}
        aria-valuetext={valueText}
        tabIndex={0}
        className="mt-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent"
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-[150px] w-full"
          aria-hidden
          focusable="false"
        >
          {/* hysteresis band, on the strip's own x-domain */}
          <rect
            x={xClear}
            y={BAND_Y}
            width={Math.max(0, xTrip - xClear)}
            height={BAND_H}
            rx={2}
            className="fill-current text-ns-muted opacity-40"
          />
          <line
            x1={xClear}
            x2={xClear}
            y1={BAND_Y - TICK_H / 2}
            y2={BAND_Y + BAND_H + TICK_H / 2}
            className="stroke-current text-border"
            strokeWidth={1}
          />
          <line
            x1={xTrip}
            x2={xTrip}
            y1={BAND_Y - TICK_H / 2}
            y2={BAND_Y + BAND_H + TICK_H / 2}
            className="stroke-current text-border"
            strokeWidth={1}
          />
          {/* live position marker along the band */}
          <circle
            cx={xValue}
            cy={BAND_Y + BAND_H / 2}
            r={3}
            className="fill-current text-foreground"
          />

          {/* mounting posts, fixed endpoints of the strip */}
          <rect
            x={ANCHOR_L_X - 4}
            y={BASE_Y - 9}
            width={8}
            height={18}
            rx={2}
            className="fill-current text-border"
          />
          <rect
            x={ANCHOR_R_X - 4}
            y={BASE_Y - 9}
            width={8}
            height={18}
            rx={2}
            className="fill-current text-border"
          />

          {/* the strip itself — one quadratic bezier, control point is the mechanism */}
          <path
            d={stripD}
            fill="none"
            className="ns-bimetal-strip stroke-current text-foreground"
            style={stripStyle}
            strokeWidth={latched ? 3.5 : 2}
            strokeLinecap="round"
          />

          {/* contact assembly: fixed post + pad the strip's tip closes against */}
          <line
            x1={MID_X}
            x2={MID_X}
            y1={POST_TOP_Y}
            y2={CONTACT_Y}
            className="stroke-current text-border"
            strokeWidth={1.5}
          />
          <rect
            x={MID_X - PAD_W / 2}
            y={CONTACT_Y - PAD_H / 2}
            width={PAD_W}
            height={PAD_H}
            rx={1.5}
            className={
              latched
                ? "fill-current text-foreground"
                : "fill-none stroke-current text-border"
            }
            strokeWidth={latched ? 0 : 1.5}
          />
          {latched ? (
            <circle
              data-bimetal-contact-lit
              cx={MID_X}
              cy={CONTACT_Y}
              r={4}
              className="fill-current text-foreground"
            />
          ) : null}
        </svg>
      </div>

      <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-ns-muted">
        <span>
          clears {fmt(clearAt)}
          {unit}
        </span>
        <span>
          trips {fmt(tripAt)}
          {unit}
        </span>
      </div>

      <p id={descId} className="mt-2 text-center font-mono text-[11px] text-ns-muted">
        {description}
      </p>

      <span id={liveId} role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
