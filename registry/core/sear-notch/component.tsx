"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SearNotch — an alert-rule builder where the rule is a notch cut directly
// into a live historical sparkline instead of two number inputs beside a
// chart. Two real role=slider controls live INSIDE the chart itself: the
// notch's floor bar (drag down/up) sets the threshold, its right shoulder
// (drag apart from the fixed left shoulder) sets the required dwell duration
// — both continuous while dragging, the duration snapping to the four
// buckets a real alerting backend accepts (30s/1m/5m/15m) on release.
//
// One governing scalar does all the work: dwell fraction
//   d = (continuous time the metric has stayed above threshold) / forMs
// Every CLOSED historical excursion (a contiguous above-threshold span found
// by walking the series and linearly interpolating the exact crossing
// times, never by a coarser "did the peak cross the line" test) is
// classified by replaying that same formula against its own duration:
// fired = excursion.duration >= forMs. That is why narrowing the duration
// handle while watching the chart visibly flips hollow near-misses solid —
// the excursion boundaries themselves come from the threshold crossing, and
// firing comes from comparing that span's real duration to forMs, so both
// handles participate in every classification, never a shortcut. The
// backtest count therefore recomputes on every pointermove during a drag,
// not debounced — a debounce would make it feel like a server round-trip
// and the count would stop being trusted mid-drag.
//
// The still-open excursion at the very end of history (if the series is
// still above threshold going into "now") answers the OTHER question —
// "is it about to fire right now" — and is deliberately kept out of the
// backtest count (it has no resolved duration yet). It drives the sear: a
// small pivoting SVG catch beside the chart whose rotation is exactly
// d * its engagement arc, backed by a live gauge whose fill height is that
// same d, with "fired" being exactly d >= 1 — no independent latch, no
// hysteresis, no separate boolean; unlike this registry's meter-threshold-
// trip (which deliberately DOES latch on a trip/re-arm pair), the sear
// un-cocks the instant the live value drops back under threshold, because
// the whole point here is one scalar driving catch + fill + fired state
// with zero independent choreography.
// ---------------------------------------------------------------------------

export interface SearNotchPoint {
  /** elapsed ms, ascending, evenly or unevenly spaced */
  t: number;
  /** metric reading at this sample */
  v: number;
}

export interface SearNotchProps {
  /** historical samples the rule is backtested against, ascending by t */
  data: SearNotchPoint[];
  /** the metric's current live reading; defaults to the last sample's value */
  liveValue?: number;
  /** display domain floor; defaults to a padded min of `data` */
  min?: number;
  /** display domain ceiling; defaults to a padded max of `data` */
  max?: number;
  /** unit suffix for readouts, e.g. "ms", "%", "req/s" */
  unit?: string;
  /** what's being watched, e.g. "checkout p99 latency" */
  metricLabel?: string;
  /** the backtest window, e.g. "past 40 min" — used verbatim in readouts */
  windowLabel?: string;
  /** controlled threshold */
  threshold?: number;
  /** uncontrolled initial threshold */
  defaultThreshold?: number;
  /** fires on every committed threshold change (drag move or keyboard) */
  onThresholdChange?: (value: number) => void;
  /** controlled required-dwell duration, ms */
  forMs?: number;
  /** uncontrolled initial required-dwell duration, ms (default 60000) */
  defaultForMs?: number;
  /** fires when the duration settles on a new bucket (drag release or keyboard) */
  onForChange?: (ms: number) => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const DURATIONS = [
  { ms: 30_000, label: "30s", px: 16 },
  { ms: 60_000, label: "1m", px: 30 },
  { ms: 300_000, label: "5m", px: 48 },
  { ms: 900_000, label: "15m", px: 68 },
] as const;

const VIEW_W = 520;
const VIEW_H = 190;
const LEFT_PAD = 16;
const RIGHT_PAD = 16;
const TOP_PAD = 14;
const BOTTOM_PAD = 18;
const PLOT_W = VIEW_W - LEFT_PAD - RIGHT_PAD;
const PLOT_H = VIEW_H - TOP_PAD - BOTTOM_PAD;
const BASE_Y = TOP_PAD + PLOT_H;
const NOTCH_ANCHOR_FRAC = 0.8; // where the notch's fixed left shoulder sits
const MIN_HALF_PX = DURATIONS[0].px;
const MAX_HALF_PX = DURATIONS[DURATIONS.length - 1].px;

const SEAR_W = 72;
const SEAR_H = VIEW_H;
const SEAR_PIVOT_X = 30;
const SEAR_PIVOT_Y = 40;
const SEAR_REST_DEG = -34;
const SEAR_TRIGGER_DEG = 46;
const SEAR_ARM_LEN = 22;
const GAUGE_X = 14;
const GAUGE_TOP = 66;
const GAUGE_BOTTOM = SEAR_H - 22;
const GAUGE_H = GAUGE_BOTTOM - GAUGE_TOP;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (Number.isInteger(n) || abs >= 100) return Math.round(n).toString();
  return n.toFixed(1);
}

function pxFromMs(ms: number) {
  const clamped = clamp(ms, DURATIONS[0].ms, DURATIONS[DURATIONS.length - 1].ms);
  for (let i = 0; i < DURATIONS.length - 1; i++) {
    const a = DURATIONS[i];
    const b = DURATIONS[i + 1];
    if (clamped >= a.ms && clamped <= b.ms) {
      const t = (Math.log(clamped) - Math.log(a.ms)) / (Math.log(b.ms) - Math.log(a.ms));
      return a.px + (b.px - a.px) * t;
    }
  }
  return DURATIONS[DURATIONS.length - 1].px;
}

function msFromPx(px: number) {
  const clamped = clamp(px, MIN_HALF_PX, MAX_HALF_PX);
  for (let i = 0; i < DURATIONS.length - 1; i++) {
    const a = DURATIONS[i];
    const b = DURATIONS[i + 1];
    if (clamped >= a.px && clamped <= b.px) {
      const t = (clamped - a.px) / (b.px - a.px);
      return Math.round(Math.exp(Math.log(a.ms) + (Math.log(b.ms) - Math.log(a.ms)) * t));
    }
  }
  return DURATIONS[DURATIONS.length - 1].ms;
}

function nearestDurationIndex(ms: number) {
  let best = 0;
  let bestDist = Infinity;
  DURATIONS.forEach((d, i) => {
    const dist = Math.abs(Math.log(ms) - Math.log(d.ms));
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}

function durationLabel(ms: number) {
  const i = nearestDurationIndex(ms);
  return DURATIONS[i].label;
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

interface ClosedExcursion {
  startT: number;
  endT: number;
  duration: number;
  points: string;
  fired: boolean;
}

// Walks the series once and finds every contiguous above-threshold span,
// interpolating the exact crossing time (never snapping to a sample) so the
// resulting duration is what a real backend would have measured. Firing is
// then a pure comparison against forMs — replaying the same dwell-fraction
// idea the live sear uses, not a cheaper "did it peek over the line" check.
function computeExcursions(
  data: SearNotchPoint[],
  threshold: number,
  forMs: number,
  xFor: (t: number) => number,
  yFor: (v: number) => number,
  floorY: number
): { closed: ClosedExcursion[]; openStartT: number | null } {
  const closed: ClosedExcursion[] = [];
  let openStartT: number | null = null;
  let pts: string[] = [];

  const crossT = (a: SearNotchPoint, b: SearNotchPoint) => {
    const f = (threshold - a.v) / (b.v - a.v || 1e-9);
    return a.t + clamp(f, 0, 1) * (b.t - a.t);
  };

  for (let i = 0; i < data.length; i++) {
    const cur = data[i];
    const curAbove = cur.v > threshold;
    if (i === 0) {
      if (curAbove) {
        openStartT = cur.t;
        pts = [`${xFor(cur.t)},${floorY}`, `${xFor(cur.t)},${yFor(cur.v)}`];
      }
      continue;
    }
    const prev = data[i - 1];
    const prevAbove = prev.v > threshold;
    if (!prevAbove && curAbove) {
      const t0 = crossT(prev, cur);
      openStartT = t0;
      pts = [`${xFor(t0)},${floorY}`, `${xFor(cur.t)},${yFor(cur.v)}`];
    } else if (prevAbove && curAbove) {
      pts.push(`${xFor(cur.t)},${yFor(cur.v)}`);
    } else if (prevAbove && !curAbove && openStartT !== null) {
      const t1 = crossT(prev, cur);
      pts.push(`${xFor(t1)},${floorY}`);
      const duration = t1 - openStartT;
      closed.push({
        startT: openStartT,
        endT: t1,
        duration,
        points: pts.join(" "),
        fired: duration >= forMs,
      });
      openStartT = null;
      pts = [];
    }
  }

  return { closed, openStartT };
}

export function SearNotch({
  data,
  liveValue,
  min,
  max,
  unit = "ms",
  metricLabel = "Checkout p99 latency",
  windowLabel = "past 40 min",
  threshold: thresholdProp,
  defaultThreshold,
  onThresholdChange,
  forMs: forMsProp,
  defaultForMs = 60_000,
  onForChange,
  className = "",
}: SearNotchProps) {
  const uid = useId();
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  const dataMin = data.length ? Math.min(...data.map((d) => d.v)) : 0;
  const dataMax = data.length ? Math.max(...data.map((d) => d.v)) : 1;
  const pad = (dataMax - dataMin) * 0.14 || Math.max(1, dataMax * 0.1);
  const domainMin = min ?? Math.floor(dataMin - pad);
  const domainMax = max ?? Math.ceil(dataMax + pad);

  const isThresholdControlled = thresholdProp !== undefined;
  const [thresholdState, setThresholdState] = useState(
    () => thresholdProp ?? defaultThreshold ?? domainMin + (domainMax - domainMin) * 0.62
  );
  const threshold = isThresholdControlled ? (thresholdProp as number) : thresholdState;
  const thresholdRef = useRef(threshold);
  thresholdRef.current = threshold;

  const isForControlled = forMsProp !== undefined;
  const [forMsState, setForMsState] = useState(() => forMsProp ?? defaultForMs);
  const forMs = isForControlled ? (forMsProp as number) : forMsState;
  const forMsRef = useRef(forMs);
  forMsRef.current = forMs;

  // continuous half-width in px while dragging the duration shoulder; snaps
  // to the settled bucket's canonical px whenever not actively dragging
  const [halfWidthPx, setHalfWidthPx] = useState(() => pxFromMs(forMs));
  const draggingDurationRef = useRef(false);
  useEffect(() => {
    if (!draggingDurationRef.current) setHalfWidthPx(pxFromMs(forMs));
  }, [forMs]);

  const [grabbedThreshold, setGrabbedThreshold] = useState(false);
  const [grabbedDuration, setGrabbedDuration] = useState(false);
  const [focusedSlider, setFocusedSlider] = useState<"threshold" | "duration" | null>(null);
  const [announce, setAnnounce] = useState("");

  const t0 = data[0]?.t ?? 0;
  const tN = data[data.length - 1]?.t ?? 1;
  const tSpan = Math.max(1e-6, tN - t0);
  const xFor = (t: number) => LEFT_PAD + ((t - t0) / tSpan) * PLOT_W;
  const domain = Math.max(1e-6, domainMax - domainMin);
  const yFor = (v: number) => BASE_Y - ((clamp(v, domainMin, domainMax) - domainMin) / domain) * PLOT_H;
  const valueFromY = (y: number) => domainMin + clamp((BASE_Y - y) / PLOT_H, 0, 1) * domain;

  const floorY = yFor(threshold);
  const x0 = LEFT_PAD + PLOT_W * NOTCH_ANCHOR_FRAC;
  const leftEdgeX = x0 - halfWidthPx;
  const rightEdgeX = x0 + halfWidthPx;

  const { closed: excursions } = useMemo(
    () => computeExcursions(data, threshold, forMs, xFor, yFor, floorY),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, threshold, forMs, domainMin, domainMax]
  );
  const firedCount = excursions.filter((e) => e.fired).length;

  // ---- live dwell: the trailing question, answered independently of the
  // backtest replay above. Purely d = elapsed-above-threshold / forMs, reset
  // the instant the live value stops clearing the bar — no latch.
  const live = liveValue ?? data[data.length - 1]?.v ?? domainMin;
  const aboveSinceRef = useRef<number | null>(null);
  const [searD, setSearD] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const above = live > threshold;
    if (above && aboveSinceRef.current === null) {
      aboveSinceRef.current = performance.now();
    } else if (!above) {
      aboveSinceRef.current = null;
      setSearD(0);
    }
  }, [live, threshold]);

  useEffect(() => {
    const tick = () => {
      const since = aboveSinceRef.current;
      if (since !== null) {
        const d = clamp((performance.now() - since) / forMsRef.current, 0, 1);
        setSearD(d);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = 0;
      }
    };
    if (aboveSinceRef.current !== null && !rafRef.current) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [live, threshold, forMs]);

  const dwelling = aboveSinceRef.current !== null;
  const fired = searD >= 1;
  const searDisplayD = reduced ? (fired ? 1 : dwelling ? 0.999 : 0) : searD;
  const searAngle = SEAR_REST_DEG + searDisplayD * (SEAR_TRIGGER_DEG - SEAR_REST_DEG);

  // ---- shared composite valuetext + status, per the a11y brief
  const valueText = `threshold ${fmt(threshold)}${unit} for ${durationLabel(forMs)} — would have fired ${firedCount} ${firedCount === 1 ? "time" : "times"} ${windowLabel}`;
  const liveStatus = fired
    ? "firing now"
    : dwelling
      ? `armed — ${Math.round(searD * 100)}% to firing`
      : "clear";

  const commitAnnounce = () => setAnnounce(`${valueText}. Live: ${liveStatus}.`);

  const commitThreshold = (v: number) => {
    const next = Number(clamp(v, domainMin, domainMax).toFixed(4));
    if (!isThresholdControlled) setThresholdState(next);
    onThresholdChange?.(next);
    thresholdRef.current = next;
  };

  const commitForMs = (ms: number) => {
    if (!isForControlled) setForMsState(ms);
    onForChange?.(ms);
    forMsRef.current = ms;
  };

  // ---- pointer drag: threshold (vertical) over the full plot height at the
  // notch's x-span, duration (horizontal) over a fixed band right of x0
  const chartRectPx = () => rootRef.current?.getBoundingClientRect() ?? null;
  const localY = (clientY: number) => {
    const r = chartRectPx();
    if (!r) return 0;
    return ((clientY - r.top) / r.height) * VIEW_H;
  };
  const localX = (clientX: number) => {
    const r = chartRectPx();
    if (!r) return 0;
    return ((clientX - r.left) / r.width) * VIEW_W;
  };

  const onThresholdPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setGrabbedThreshold(true);
    commitThreshold(valueFromY(localY(e.clientY)));
    e.preventDefault();
  };
  const onThresholdPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!grabbedThreshold) return;
    commitThreshold(valueFromY(localY(e.clientY)));
  };
  const endThresholdDrag = () => {
    if (!grabbedThreshold) return;
    setGrabbedThreshold(false);
    commitAnnounce();
  };

  const onDurationPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setGrabbedDuration(true);
    draggingDurationRef.current = true;
    const px = clamp(localX(e.clientX) - x0, MIN_HALF_PX, MAX_HALF_PX);
    setHalfWidthPx(px);
    commitForMs(msFromPx(px));
    e.preventDefault();
  };
  const onDurationPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!grabbedDuration) return;
    const px = clamp(localX(e.clientX) - x0, MIN_HALF_PX, MAX_HALF_PX);
    setHalfWidthPx(px);
    commitForMs(msFromPx(px));
  };
  const endDurationDrag = () => {
    if (!grabbedDuration) return;
    setGrabbedDuration(false);
    draggingDurationRef.current = false;
    const idx = nearestDurationIndex(forMsRef.current);
    const snapped = DURATIONS[idx].ms;
    setHalfWidthPx(DURATIONS[idx].px);
    commitForMs(snapped);
    commitAnnounce();
  };

  const thresholdStep = Math.max(1e-6, domain / 100);
  const onThresholdKeyDown = (e: React.KeyboardEvent) => {
    let next: number | null = null;
    const v = thresholdRef.current;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        next = v + thresholdStep;
        break;
      case "ArrowDown":
      case "ArrowLeft":
        next = v - thresholdStep;
        break;
      case "PageUp":
        next = v + thresholdStep * 10;
        break;
      case "PageDown":
        next = v - thresholdStep * 10;
        break;
      case "Home":
        next = domainMin;
        break;
      case "End":
        next = domainMax;
        break;
      default:
        return;
    }
    e.preventDefault();
    commitThreshold(next);
    commitAnnounce();
  };

  const onDurationKeyDown = (e: React.KeyboardEvent) => {
    const idx = nearestDurationIndex(forMsRef.current);
    let nextIdx: number | null = null;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        nextIdx = clamp(idx + 1, 0, DURATIONS.length - 1);
        break;
      case "ArrowDown":
      case "ArrowLeft":
        nextIdx = clamp(idx - 1, 0, DURATIONS.length - 1);
        break;
      case "Home":
        nextIdx = 0;
        break;
      case "End":
        nextIdx = DURATIONS.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    setHalfWidthPx(DURATIONS[nextIdx].px);
    commitForMs(DURATIONS[nextIdx].ms);
    commitAnnounce();
  };

  const thresholdHitTop = (TOP_PAD / VIEW_H) * 100;
  const thresholdHitHeight = (PLOT_H / VIEW_H) * 100;
  const thresholdHitLeft = (leftEdgeX / VIEW_W) * 100;
  const thresholdHitWidth = ((rightEdgeX - leftEdgeX) / VIEW_W) * 100;

  const durationHitLeft = (x0 / VIEW_W) * 100;
  const durationHitWidth = ((VIEW_W - RIGHT_PAD - x0) / VIEW_W) * 100;
  const durationHitTop = ((floorY - 16) / VIEW_H) * 100;
  const durationHitHeight = (32 / VIEW_H) * 100;

  const labelId = `${uid}-label`;
  const liveId = `${uid}-live`;

  return (
    <div className={`font-sans ${className}`}>
      <style>{CSS}</style>

      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="font-mono text-[11px] tracking-wide text-ns-muted">
          {metricLabel.toUpperCase()}
        </span>
        <span className="font-mono text-[11px] tracking-wide text-foreground">
          {fired ? "FIRING" : dwelling ? "ARMED" : "CLEAR"}
        </span>
      </div>

      <div className="mt-2 flex gap-2">
        <div
          ref={rootRef}
          className="ns-sear-chart relative flex-1 select-none"
          style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
        >
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-full w-full" aria-hidden focusable="false">
            {/* threshold reference, full width */}
            <line
              x1={LEFT_PAD}
              x2={VIEW_W - RIGHT_PAD}
              y1={floorY}
              y2={floorY}
              className="stroke-current text-border"
              strokeWidth={1}
              strokeDasharray="2 3"
            />

            {/* the sparkline itself */}
            {data.length > 1 ? (
              <polyline
                points={data.map((d) => `${xFor(d.t)},${yFor(d.v)}`).join(" ")}
                fill="none"
                className="stroke-current text-foreground"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}

            {/* every closed excursion, classified by dwell — fired fills
                solid, a near-miss that crossed but never dwelled stays a
                hollow dashed outline */}
            {excursions.map((ex) => (
              <polygon
                key={ex.startT}
                points={ex.points}
                className={
                  ex.fired
                    ? "fill-current text-foreground opacity-80"
                    : "fill-none stroke-current text-ns-muted"
                }
                strokeWidth={ex.fired ? 0 : 1.25}
                strokeDasharray={ex.fired ? undefined : "3 2"}
              />
            ))}

            {/* the notch — a literal cut toward the live edge. shoulders run
                from the top rail down to the floor bar; the right shoulder
                and the floor bar are the two drag handles */}
            <g className="text-foreground">
              <line
                x1={leftEdgeX}
                x2={leftEdgeX}
                y1={TOP_PAD}
                y2={floorY}
                className="stroke-current"
                strokeWidth={1.5}
              />
              <line
                x1={rightEdgeX}
                x2={rightEdgeX}
                y1={TOP_PAD}
                y2={floorY}
                className={`stroke-current ${grabbedDuration || focusedSlider === "duration" ? "text-ns-accent" : ""}`}
                strokeWidth={grabbedDuration || focusedSlider === "duration" ? 3 : 1.5}
              />
              <line
                x1={leftEdgeX}
                x2={rightEdgeX}
                y1={floorY}
                y2={floorY}
                className={`stroke-current ${grabbedThreshold || focusedSlider === "threshold" ? "text-ns-accent" : ""}`}
                strokeWidth={grabbedThreshold || focusedSlider === "threshold" ? 4 : 2}
                strokeLinecap="round"
              />
            </g>

            {/* the two tuned values, printed right on the notch — a reader
                should never have to compare the shoulder gap's pixel width
                against the time axis to know the duration; the number is
                right there. */}
            <text
              x={leftEdgeX - 4}
              y={floorY - 5}
              textAnchor="end"
              className="fill-current font-mono text-[8px] text-ns-muted"
            >
              {fmt(threshold)}
              {unit}
            </text>
            <text
              x={(leftEdgeX + rightEdgeX) / 2}
              y={TOP_PAD + 8}
              textAnchor="middle"
              className="fill-current font-mono text-[8px] text-ns-muted"
            >
              for {durationLabel(forMs)}
            </text>
          </svg>

          {/* threshold — role=slider, vertical, hit area spans the full
              plot height at the notch's x-span */}
          <div
            role="slider"
            tabIndex={0}
            aria-label="Alert threshold"
            aria-orientation="vertical"
            aria-labelledby={labelId}
            aria-valuemin={domainMin}
            aria-valuemax={domainMax}
            aria-valuenow={Number(threshold.toFixed(2))}
            aria-valuetext={valueText}
            data-sear-notch-threshold
            className="ns-sear-hit absolute cursor-ns-resize touch-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{
              left: `${thresholdHitLeft}%`,
              top: `${thresholdHitTop}%`,
              width: `${thresholdHitWidth}%`,
              height: `${thresholdHitHeight}%`,
            }}
            onPointerDown={onThresholdPointerDown}
            onPointerMove={onThresholdPointerMove}
            onPointerUp={endThresholdDrag}
            onPointerCancel={endThresholdDrag}
            onKeyDown={onThresholdKeyDown}
            onFocus={() => setFocusedSlider("threshold")}
            onBlur={() => setFocusedSlider((s) => (s === "threshold" ? null : s))}
          />

          {/* duration — role=slider, horizontal, hit area is the fixed band
              right of the notch's anchor so a drag anywhere in it works */}
          <div
            role="slider"
            tabIndex={0}
            aria-label="Required dwell duration"
            aria-orientation="horizontal"
            aria-labelledby={labelId}
            aria-valuemin={DURATIONS[0].ms}
            aria-valuemax={DURATIONS[DURATIONS.length - 1].ms}
            aria-valuenow={forMs}
            aria-valuetext={valueText}
            data-sear-notch-duration
            className="ns-sear-hit absolute cursor-ew-resize touch-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{
              left: `${durationHitLeft}%`,
              top: `${durationHitTop}%`,
              width: `${durationHitWidth}%`,
              height: `${durationHitHeight}%`,
            }}
            onPointerDown={onDurationPointerDown}
            onPointerMove={onDurationPointerMove}
            onPointerUp={endDurationDrag}
            onPointerCancel={endDurationDrag}
            onKeyDown={onDurationKeyDown}
            onFocus={() => setFocusedSlider("duration")}
            onBlur={() => setFocusedSlider((s) => (s === "duration" ? null : s))}
          />
        </div>

        {/* the sear: a live gauge (fill height = d) beside a pivoting catch
            (rotation = d * engagement arc), releasing exactly at d >= 1 */}
        <svg
          viewBox={`0 0 ${SEAR_W} ${SEAR_H}`}
          width={SEAR_W}
          className="ns-sear-catch shrink-0"
          aria-hidden
          focusable="false"
        >
          <rect
            x={GAUGE_X - 3}
            y={GAUGE_TOP}
            width={6}
            height={GAUGE_H}
            rx={3}
            className="fill-none stroke-current text-border"
            strokeWidth={1}
          />
          <rect
            x={GAUGE_X - 3}
            y={GAUGE_BOTTOM - searDisplayD * GAUGE_H}
            width={6}
            height={Math.max(0, searDisplayD * GAUGE_H)}
            rx={3}
            className={fired ? "fill-current text-foreground" : "fill-current text-foreground opacity-55"}
          />

          <line
            x1={SEAR_PIVOT_X + 10}
            y1={SEAR_PIVOT_Y}
            x2={SEAR_PIVOT_X + 10 + SEAR_ARM_LEN * Math.cos((SEAR_TRIGGER_DEG * Math.PI) / 180)}
            y2={SEAR_PIVOT_Y + SEAR_ARM_LEN * Math.sin((SEAR_TRIGGER_DEG * Math.PI) / 180)}
            className="stroke-current text-border"
            strokeWidth={1.5}
          />
          {fired ? (
            <circle
              data-sear-notch-fired
              cx={SEAR_PIVOT_X + 10 + SEAR_ARM_LEN * Math.cos((SEAR_TRIGGER_DEG * Math.PI) / 180)}
              cy={SEAR_PIVOT_Y + SEAR_ARM_LEN * Math.sin((SEAR_TRIGGER_DEG * Math.PI) / 180)}
              r={3.5}
              className="fill-current text-foreground"
            />
          ) : null}

          <circle cx={SEAR_PIVOT_X} cy={SEAR_PIVOT_Y} r={2.5} className="fill-current text-border" />
          <g
            className="ns-sear-arm"
            style={{ transform: `rotate(${searAngle}deg)`, transformOrigin: `${SEAR_PIVOT_X}px ${SEAR_PIVOT_Y}px` }}
          >
            <line
              x1={SEAR_PIVOT_X}
              y1={SEAR_PIVOT_Y}
              x2={SEAR_PIVOT_X + SEAR_ARM_LEN}
              y2={SEAR_PIVOT_Y}
              className="stroke-current text-foreground"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[11px] text-ns-muted">
        <span>
          threshold <span className="tabular-nums text-foreground">{fmt(threshold)}{unit}</span>
        </span>
        <span>
          for <span className="tabular-nums text-foreground">{durationLabel(forMs)}</span>
        </span>
      </div>

      <p className="mt-1.5 font-mono text-[11px] text-ns-muted">
        would have fired{" "}
        <strong className="tabular-nums font-semibold text-foreground">{firedCount}</strong>{" "}
        {firedCount === 1 ? "time" : "times"} {windowLabel} · live: {liveStatus}
      </p>

      <span id={liveId} role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

const CSS = `
.ns-sear-arm { transition: transform 140ms cubic-bezier(0.16, 1, 0.3, 1); }
@media (prefers-reduced-motion: reduce) {
  .ns-sear-arm { transition: none !important; }
}
`;
