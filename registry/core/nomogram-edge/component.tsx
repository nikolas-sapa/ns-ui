"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// NomogramEdge — a two-input estimator built as a real paper nomogram, not a
// decorated pair of sliders. Three vertical ASCII scales (tick glyphs ─ ┬ on
// a │ spine): left and right carry draggable role=slider handles, the middle
// is read-only and sits at the exact horizontal midpoint. GEOMETRY: with a
// shared log modulus R = ln(leftMax/leftMin) and both outer scales anchored
// so their own max maps to frac 0 (top), frac(u) = ln(leftMax/u)/R and
// frac(v) = ln(rightMax/v)/R. Because the middle column is the true pixel
// midpoint between the two handles, the straight line's crossing there is
// ALWAYS (fracLeft+fracRight)/2 by the intercept theorem — so rendering the
// middle scale's own ticks at frac(w) = ln(wMax/w)/(2R), wMax = leftMax *
// rightMax, makes a straight SVG line between the handles land exactly on
// the middle scale's tick for w = u*v. No pixel measurement, no canvas: the
// crossing is computed analytically (result = leftValue*rightValue) and
// placed at that same halfway-average fraction, so the drawn line and the
// printed number are provably the same answer. R is taken from the LEFT
// domain only — the right scale (and therefore the middle scale, since it's
// the average) may span less than the full track when its own log-ratio is
// smaller than the left's, ending at a real "══" scale cap rather than
// filling the column. That's authentic nomography, not a bug: doubling the
// right value moves the crossing by ln(2)/(2R) same as doubling the left
// would, but a scale whose reachable domain covers fewer decades swings the
// SAME handle travel through a much bigger fraction of its own range, which
// is the actual sensitivity story this component tells. `mode="sum"` swaps
// the same machinery to linear scales/addition for non-multiplicative pairs.
// Handles are role=slider with arrow/page/home/end tick-stepping; drag is
// continuous and un-quantized, release snaps to the nearest tick with a
// spring-flavored CSS ease (skipped under prefers-reduced-motion, detected
// in JS so the transition can be fully suppressed rather than just shortened).
// The straightedge carries a small quadratic-bezier sag while a handle is
// down (control point offset from the true midpoint) and eases flat again on
// release — decorative only; the crossing computation never reads the path.
// DOM + inline SVG only, no canvas. --ns-accent appears nowhere but the
// grabbed handle and focus rings.
// ---------------------------------------------------------------------------

type Mode = "product" | "sum";
type Side = "left" | "right";
type Tick = { value: number; major: boolean };

const TRACK_H_DEFAULT = 480; // px, track column height — a pricing-hero instrument, not a form-row widget
const SAG = 3.2; // viewBox units, straightedge sag while a handle is down
// A handful of illustrative (fracLeft, fracRight) waypoints the crossing
// drifts through before anyone touches the component — spread across the
// domain so the sensitivity story (one side swinging the crossing more than
// the other) is visible without a single click. Permanently cancelled on the
// first real pointerdown/keydown (see interactedRef) and never started under
// reduced motion.
const IDLE_WAYPOINTS: [number, number][] = [
  [0.14, 0.82],
  [0.62, 0.26],
  [0.36, 0.58],
  [0.8, 0.12],
];
const IDLE_STEP_MS = 2600;
const IDLE_FIRST_DELAY_MS = 1100;
const ENTRY_FRAC = 0.5; // both handles start here on mount and spring out to their real reading
const ENTRANCE_MS = 640; // draw-in duration, same overshoot curve as the interactive snap

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function refSpanOf(mode: Mode, min: number, max: number): number {
  return mode === "product" ? Math.log(max / min) : max - min;
}

// frac 0 = anchorMax (top of column), frac grows downward as value falls.
function fracOf(mode: Mode, value: number, anchorMax: number, refSpan: number): number {
  if (mode === "product") {
    const v = value > 0 ? value : anchorMax * 1e-9;
    return Math.log(anchorMax / v) / refSpan;
  }
  return (anchorMax - value) / refSpan;
}

function valueOf(mode: Mode, frac: number, anchorMax: number, refSpan: number): number {
  return mode === "product" ? anchorMax * Math.exp(-frac * refSpan) : anchorMax - frac * refSpan;
}

function combine(mode: Mode, u: number, v: number): number {
  return mode === "product" ? u * v : u + v;
}

function buildLogTicks(min: number, max: number): Tick[] {
  const out: Tick[] = [];
  const k0 = Math.floor(Math.log10(min));
  const k1 = Math.ceil(Math.log10(max));
  for (let k = k0; k <= k1; k++) {
    for (const m of [1, 2, 5]) {
      const v = m * Math.pow(10, k);
      if (v >= min * 0.999 && v <= max * 1.001) out.push({ value: v, major: m === 1 });
    }
  }
  return out.sort((a, b) => a.value - b.value);
}

function niceLinearStep(range: number): number {
  const raw = range / 8;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return nice * mag;
}

function buildLinearTicks(min: number, max: number): Tick[] {
  const step = niceLinearStep(max - min) || 1;
  const out: Tick[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + step * 1e-6; v += step) {
    out.push({ value: Number(v.toFixed(6)), major: Math.round(v / step) % 5 === 0 });
  }
  return out;
}

function buildTicks(mode: Mode, min: number, max: number): Tick[] {
  return mode === "product" ? buildLogTicks(min, max) : buildLinearTicks(min, max);
}

function fmtCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (abs >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  if (abs > 0 && abs < 1) return v.toFixed(abs < 0.01 ? 3 : 2).replace(/0+$/, "").replace(/\.$/, "");
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function usePrefersReducedMotion(): boolean {
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

export interface NomogramEdgeProps {
  /** "product" (log scales, w = left*right) or "sum" (linear scales, w = left+right) */
  mode?: Mode;
  leftLabel?: string;
  rightLabel?: string;
  middleLabel?: string;
  leftMin?: number;
  leftMax?: number;
  rightMin?: number;
  rightMax?: number;
  defaultLeftValue?: number;
  defaultRightValue?: number;
  formatLeft?: (v: number) => string;
  formatRight?: (v: number) => string;
  formatResult?: (v: number) => string;
  onValuesChange?: (left: number, right: number, result: number) => void;
  /** Track column height in px. Default 480 — a full instrument, not a form-row control. */
  trackHeight?: number;
  /** Before any interaction, the crossing drifts through a few illustrative
   * value pairs on its own (off under prefers-reduced-motion, and cancelled
   * for good the moment a real drag or keystroke lands). Default true. */
  ambient?: boolean;
  className?: string;
}

export function NomogramEdge({
  mode = "product",
  leftLabel = "Requests / mo",
  rightLabel = "Price / request",
  middleLabel = "Monthly cost",
  leftMin = 100,
  leftMax = 100_000,
  rightMin = 0.01,
  rightMax = 1,
  defaultLeftValue = 100_000,
  defaultRightValue = 0.01,
  formatLeft = (v) => `${fmtCompact(v)} requests`,
  formatRight = (v) => `$${v.toFixed(2)}/request`,
  formatResult = (v) => (v >= 1000 ? `$${Math.round(v).toLocaleString()}/mo` : `$${v.toFixed(2)}/mo`),
  onValuesChange,
  trackHeight = TRACK_H_DEFAULT,
  ambient = true,
  className = "",
}: NomogramEdgeProps) {
  const reduced = usePrefersReducedMotion();

  const [leftValue, setLeftValue] = useState(() => clamp(defaultLeftValue, leftMin, leftMax));
  const [rightValue, setRightValue] = useState(() => clamp(defaultRightValue, rightMin, rightMax));
  const [dragging, setDragging] = useState<Side | null>(null);
  // flips (and stays flipped) the instant a real drag or keystroke lands —
  // ends the idle drift for good and switches the handle's `top` easing from
  // the slow ambient drift back to the snappy interactive spring.
  const [interacted, setInteracted] = useState(false);
  const interactedRef = useRef(false);
  const stepIndexRef = useRef(0);
  const markInteracted = useCallback(() => {
    if (interactedRef.current) return;
    interactedRef.current = true;
    setInteracted(true);
  }, []);
  // `entered` flips true one paint after mount so the very first frame draws
  // both handles at ENTRY_FRAC with no transition, then the flip animates
  // them out to their real reading on the same overshoot spring as an
  // interactive snap — the "drawn in" reveal. `settled` flips true once that
  // reveal has had time to finish, so the ambient idle ease (below) doesn't
  // start competing with it. Both resolve instantly under reduced motion.
  const [entered, setEntered] = useState(false);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (reduced) {
      setEntered(true);
      setSettled(true);
      return;
    }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [reduced]);
  useEffect(() => {
    if (!entered || reduced) return;
    const t = setTimeout(() => setSettled(true), ENTRANCE_MS + 60);
    return () => clearTimeout(t);
  }, [entered, reduced]);
  const [liveText, setLiveText] = useState(
    () =>
      `${formatLeft(clamp(defaultLeftValue, leftMin, leftMax))} × ${formatRight(
        clamp(defaultRightValue, rightMin, rightMax)
      )} → ${formatResult(combine(mode, clamp(defaultLeftValue, leftMin, leftMax), clamp(defaultRightValue, rightMin, rightMax)))}`
  );

  const leftTrackRef = useRef<HTMLDivElement>(null);
  const rightTrackRef = useRef<HTMLDivElement>(null);
  const leftHandleRef = useRef<HTMLDivElement>(null);
  const rightHandleRef = useRef<HTMLDivElement>(null);
  // mirrors of the latest committed values, updated synchronously alongside
  // setState — pointerup can fire before a just-queued setState from the
  // final pointermove has landed, so the release-time snap reads these
  // refs (always current) rather than the possibly one-frame-stale state.
  const leftValueRef = useRef(leftValue);
  const rightValueRef = useRef(rightValue);
  const setLeft = (v: number) => {
    leftValueRef.current = v;
    setLeftValue(v);
  };
  const setRight = (v: number) => {
    rightValueRef.current = v;
    setRightValue(v);
  };

  const R = useMemo(() => refSpanOf(mode, leftMin, leftMax), [mode, leftMin, leftMax]);
  const rightSpanFrac = useMemo(
    () => refSpanOf(mode, rightMin, rightMax) / R,
    [mode, rightMin, rightMax, R]
  );
  const midSpanFrac = (1 + rightSpanFrac) / 2;
  const wMax = combine(mode, leftMax, rightMax);
  const wMin = combine(mode, leftMin, rightMin);

  const ticksLeft = useMemo(() => buildTicks(mode, leftMin, leftMax), [mode, leftMin, leftMax]);
  const ticksRight = useMemo(() => buildTicks(mode, rightMin, rightMax), [mode, rightMin, rightMax]);
  const ticksMid = useMemo(() => buildTicks(mode, wMin, wMax), [mode, wMin, wMax]);

  const fracLeft = fracOf(mode, leftValue, leftMax, R);
  const fracRight = fracOf(mode, rightValue, rightMax, R);
  const fracMid = (fracLeft + fracRight) / 2;
  const result = combine(mode, leftValue, rightValue);

  // visual-only positions: everything DRAWN (handles, line, crossing) reads
  // these, never the raw fracs directly, so the pre-`entered` first frame
  // paints at ENTRY_FRAC while `leftValue`/`rightValue` (and therefore every
  // number on screen) are already correct from the very first render.
  const renderFracLeft = entered ? fracLeft : ENTRY_FRAC;
  const renderFracRight = entered ? fracRight : ENTRY_FRAC;
  const renderFracMid = (renderFracLeft + renderFracRight) / 2;

  const updateFromClientY = useCallback(
    (side: Side, clientY: number) => {
      const trackEl = side === "left" ? leftTrackRef.current : rightTrackRef.current;
      if (!trackEl) return;
      const rect = trackEl.getBoundingClientRect();
      const frac = clamp((clientY - rect.top) / Math.max(1, rect.height), 0, 1);
      const anchorMax = side === "left" ? leftMax : rightMax;
      const min = side === "left" ? leftMin : rightMin;
      const max = side === "left" ? leftMax : rightMax;
      const v = clamp(valueOf(mode, frac, anchorMax, R), min, max);
      const nextLeft = side === "left" ? v : leftValueRef.current;
      const nextRight = side === "right" ? v : rightValueRef.current;
      if (side === "left") setLeft(v);
      else setRight(v);
      onValuesChange?.(nextLeft, nextRight, combine(mode, nextLeft, nextRight));
    },
    [mode, leftMin, leftMax, rightMin, rightMax, R, onValuesChange]
  );

  const commitValue = useCallback(
    (side: Side, v: number) => {
      const nextLeft = side === "left" ? v : leftValueRef.current;
      const nextRight = side === "right" ? v : rightValueRef.current;
      if (side === "left") setLeft(v);
      else setRight(v);
      const nextResult = combine(mode, nextLeft, nextRight);
      const joiner = mode === "product" ? "×" : "+";
      setLiveText(`${formatLeft(nextLeft)} ${joiner} ${formatRight(nextRight)} → ${formatResult(nextResult)}`);
      onValuesChange?.(nextLeft, nextRight, nextResult);
    },
    [mode, formatLeft, formatRight, formatResult, onValuesChange]
  );

  const nearestTickIndex = (ticks: Tick[], side: Side, current: number): number => {
    if (ticks.length === 0) return -1;
    const anchorMax = side === "left" ? leftMax : rightMax;
    const curFrac = fracOf(mode, current, anchorMax, R);
    let best = 0;
    let bestD = Infinity;
    ticks.forEach((t, i) => {
      const f = fracOf(mode, t.value, anchorMax, R);
      const d = Math.abs(f - curFrac);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  const snapToNearestTick = (side: Side) => {
    const ticks = side === "left" ? ticksLeft : ticksRight;
    const current = side === "left" ? leftValueRef.current : rightValueRef.current;
    const idx = nearestTickIndex(ticks, side, current);
    if (idx >= 0) commitValue(side, ticks[idx].value);
  };

  const onPointerDown = (side: Side) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    markInteracted();
    const trackEl = side === "left" ? leftTrackRef.current : rightTrackRef.current;
    trackEl?.setPointerCapture(e.pointerId);
    (side === "left" ? leftHandleRef : rightHandleRef).current?.focus({ preventScroll: true });
    setDragging(side);
    updateFromClientY(side, e.clientY);
  };

  const onPointerMove = (side: Side) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging !== side) return;
    updateFromClientY(side, e.clientY);
  };

  const endDrag = (side: Side) => () => {
    if (dragging !== side) return;
    setDragging(null);
    snapToNearestTick(side);
  };

  const onKeyDown = (side: Side) => (e: React.KeyboardEvent) => {
    const ticks = side === "left" ? ticksLeft : ticksRight;
    if (ticks.length === 0) return;
    const current = side === "left" ? leftValueRef.current : rightValueRef.current;
    const idx = nearestTickIndex(ticks, side, current);
    const jump = mode === "product" ? 3 : 5;
    let next = idx;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        next = idx + 1;
        break;
      case "ArrowDown":
      case "ArrowLeft":
        next = idx - 1;
        break;
      case "PageUp":
        next = idx + jump;
        break;
      case "PageDown":
        next = idx - jump;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = ticks.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    markInteracted();
    next = clamp(next, 0, ticks.length - 1);
    commitValue(side, ticks[next].value);
  };

  // Before anyone touches a handle, the crossing drifts through a few
  // illustrative waypoints on its own — this is what makes the resting frame
  // read as alive rather than a static instrument nobody has picked up.
  // Cancelled for good (interactedRef) the instant a real drag or keystroke
  // lands, whether from an actual visitor or the site's own autoplay driver
  // (both dispatch genuine pointerdown events onPointerDown already sees).
  useEffect(() => {
    if (!ambient || reduced) return;
    let cancelled = false;
    const step = () => {
      if (cancelled || interactedRef.current) return;
      const [fl, fr] = IDLE_WAYPOINTS[stepIndexRef.current % IDLE_WAYPOINTS.length];
      stepIndexRef.current += 1;
      const lv = clamp(valueOf(mode, fl, leftMax, R), leftMin, leftMax);
      const rv = clamp(valueOf(mode, fr, rightMax, R), rightMin, rightMax);
      setLeft(lv);
      setRight(rv);
      // no aria-live announce here and no `commitValue` — an autonomous
      // demo drift is not a user commit, and shouldn't read to a screen
      // reader as though someone chose these values.
      onValuesChange?.(lv, rv, combine(mode, lv, rv));
    };
    const first = setTimeout(step, IDLE_FIRST_DELAY_MS);
    const id = setInterval(step, IDLE_STEP_MS);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambient, reduced, mode, leftMin, leftMax, rightMin, rightMax, R]);

  // Four motion phases, in the order a mount actually passes through them:
  // "none" (pre-entrance first paint, no transition at all), "entrance" (the
  // spring draw-in), "idle" (the slow ambient drift, once settled and still
  // untouched), "interactive" (the normal drag-release/keyboard snap). Same
  // phase drives the handle's `top`, the crossing's `top`, and the
  // straightedge path's `d` so the three never fall out of sync with
  // each other mid-transition.
  const motionPhase: "none" | "entrance" | "idle" | "interactive" = !entered
    ? "none"
    : !settled
      ? "entrance"
      : !interacted && ambient
        ? "idle"
        : "interactive";
  const posEase =
    motionPhase === "entrance"
      ? `${ENTRANCE_MS}ms cubic-bezier(0.34,1.56,0.64,1)`
      : motionPhase === "idle"
        ? "1600ms cubic-bezier(0.45,0,0.55,1)"
        : motionPhase === "interactive"
          ? "320ms cubic-bezier(0.34,1.56,0.64,1)"
          : null;

  const handleTransition = (side: Side) =>
    reduced
      ? "none"
      : dragging === side
        ? "background-color 150ms ease, border-color 150ms ease"
        : `${posEase ? `top ${posEase}, ` : ""}background-color 150ms ease, border-color 150ms ease`;

  const crossingTransition = reduced ? "none" : posEase ? `top ${posEase}` : "none";

  const pathTransition = reduced ? "none" : posEase ? `d ${posEase}` : "none";

  // straightedge: quadratic bezier whose control point sits at the true
  // midpoint x (50) and the average of the two endpoint y's — at sag=0 this
  // is mathematically identical to a straight line through both handles.
  const x1 = 100 / 6;
  const xm = 50;
  const x2 = 500 / 6;
  const y1 = renderFracLeft * 100;
  const y2 = renderFracRight * 100;
  const sag = dragging ? SAG : 0;
  const pathD = `M ${x1.toFixed(2)} ${y1.toFixed(2)} Q ${xm} ${((y1 + y2) / 2 + sag).toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;

  const renderOuterTicks = (ticks: Tick[], side: Side, anchorMax: number) => (
    <>
      {ticks.map((t) => {
        const f = fracOf(mode, t.value, anchorMax, R);
        return (
          <div
            key={t.value}
            aria-hidden
            className="absolute left-1/2 -translate-y-1/2 select-none"
            style={{ top: `${f * 100}%` }}
          >
            <span className="font-mono text-sm leading-none text-ns-muted">{t.major ? "┬" : "─"}</span>
            {t.major ? (
              // mr-4/ml-4 (16px) clears the 16px handle's ~11.3px rotated
              // half-diagonal with margin to spare — at the old mr-1.5 (6px)
              // gap, a handle sitting at or near this tick's own value
              // visually swallowed the number it's supposed to label. `z-20`
              // plus its own `bg-background` chip is a second, size-independent
              // defense: even if a future resize shrinks that clearance again,
              // the label paints over the handle instead of the reverse.
              <span
                className={`absolute top-1/2 z-20 -translate-y-1/2 whitespace-nowrap font-mono text-xs tabular-nums text-ns-muted ${
                  side === "left" ? "right-full mr-4 text-right" : "left-full ml-4"
                }`}
              >
                <span className="rounded-sm bg-background px-0.5">{fmtCompact(t.value)}</span>
              </span>
            ) : null}
          </div>
        );
      })}
    </>
  );

  const renderMidTicks = () => (
    <>
      {ticksMid.map((t) => {
        const f = fracOf(mode, t.value, wMax, 2 * R);
        return (
          <span
            key={t.value}
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 select-none font-mono text-sm leading-none text-ns-muted"
            style={{ top: `${f * 100}%` }}
          >
            {t.major ? "┬" : "─"}
          </span>
        );
      })}
    </>
  );

  const renderSpine = (spanFrac: number) => (
    <>
      <div
        aria-hidden
        className="absolute left-1/2 top-0 w-px -translate-x-1/2 bg-border"
        style={{ height: `${clamp(spanFrac, 0, 1) * 100}%` }}
      />
      {spanFrac < 0.999 ? (
        <span
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 select-none font-mono text-xs leading-none text-ns-muted"
          style={{ top: `${clamp(spanFrac, 0, 1) * 100}%` }}
        >
          {"══"}
        </span>
      ) : null}
    </>
  );

  const renderHandle = (side: Side) => {
    const value = side === "left" ? leftValue : rightValue;
    const frac = side === "left" ? renderFracLeft : renderFracRight;
    const min = side === "left" ? leftMin : rightMin;
    const max = side === "left" ? leftMax : rightMax;
    const label = side === "left" ? leftLabel : rightLabel;
    const fmt = side === "left" ? formatLeft : formatRight;
    return (
      <div
        ref={side === "left" ? leftHandleRef : rightHandleRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(6))}
        aria-valuetext={`${fmt(value)} — estimated ${formatResult(result)}`}
        data-nomogram-handle={side}
        onKeyDown={onKeyDown(side)}
        className={`absolute left-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-grab rounded-sm border-2 outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:cursor-grabbing ${
          dragging === side ? "border-ns-accent bg-ns-accent" : "border-foreground bg-background"
        }`}
        style={{ top: `${frac * 100}%`, transition: handleTransition(side) }}
      />
    );
  };

  const renderTrack = (side: Side) => {
    const ticks = side === "left" ? ticksLeft : ticksRight;
    const anchorMax = side === "left" ? leftMax : rightMax;
    const spanFrac = side === "left" ? 1 : rightSpanFrac;
    return (
      <div
        ref={side === "left" ? leftTrackRef : rightTrackRef}
        data-nomogram-track={side}
        className="relative h-full touch-none select-none"
        onPointerDown={onPointerDown(side)}
        onPointerMove={onPointerMove(side)}
        onPointerUp={endDrag(side)}
        onPointerCancel={endDrag(side)}
        onLostPointerCapture={endDrag(side)}
      >
        {renderSpine(spanFrac)}
        {renderOuterTicks(ticks, side, anchorMax)}
        {renderHandle(side)}
      </div>
    );
  };

  return (
    <div className={`w-full max-w-3xl rounded-md border border-border bg-background p-7 font-mono ${className}`}>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-start gap-1">
          <span className="text-[11px] uppercase tracking-[0.2em] text-ns-muted">{leftLabel}</span>
          <span className="text-xl font-semibold tabular-nums text-foreground">{formatLeft(leftValue)}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] uppercase tracking-[0.2em] text-ns-muted">{middleLabel}</span>
          <span className="text-2xl font-bold tabular-nums text-foreground">{formatResult(result)}</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[11px] uppercase tracking-[0.2em] text-ns-muted">{rightLabel}</span>
          <span className="text-xl font-semibold tabular-nums text-foreground">{formatRight(rightValue)}</span>
        </div>
      </div>

      <div className="relative mt-6" style={{ height: trackHeight }}>
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full text-foreground"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d={pathD}
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
            style={{ transition: pathTransition }}
          />
        </svg>

        <div className="grid h-full grid-cols-3 gap-0">
          {renderTrack("left")}
          <div className="relative h-full">
            {renderSpine(midSpanFrac)}
            {renderMidTicks()}
            <div
              aria-hidden
              className="absolute left-1/2 z-20 flex items-center -translate-y-1/2"
              style={{ top: `${renderFracMid * 100}%`, transition: crossingTransition }}
            >
              <span className="-translate-x-1/2 select-none font-mono text-3xl font-semibold leading-none text-foreground">
                {"╪"}
              </span>
              <span className="ml-1.5 whitespace-nowrap rounded-sm border border-border bg-background px-2.5 py-1 font-mono text-sm font-bold tabular-nums text-foreground">
                {formatResult(result)}
              </span>
            </div>
          </div>
          {renderTrack("right")}
        </div>
      </div>

      <p className="mt-4 font-mono text-xs text-ns-muted">
        drag or arrow-key either handle · the straightedge crosses the middle scale at the answer
      </p>
      <p aria-live="polite" className="sr-only">
        {liveText}
      </p>
    </div>
  );
}
