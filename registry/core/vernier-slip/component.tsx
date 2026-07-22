"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// VernierSlip — a numeric input built as a true vernier caliper: a fixed
// coarse tick row (one tick per 10*step, "UNIT") sits above a sliding fine
// row whose pitch is 0.9x the coarse pitch. Given quantized value v, let
// totalSteps = round((v-min)/step), fineIdx = totalSteps mod 10 (0..9),
// coarseIdx = (totalSteps-fineIdx)/10. Real vernier math: fine tick #fineIdx
// coincides with main tick #(coarseIdx+fineIdx), not #coarseIdx — the
// matching line drifts down the fixed scale as the reading grows, exactly
// as on a physical caliper. That fine tick gets --accent plus a hairline
// back to its coincidence partner. Two drag zones on the same track: upper
// half ("body") maps pointer position to value absolutely (fast, spans the
// whole range); lower half (the vernier row itself) maps pointer DELTA to
// value at one step per fine-tick-width (slow, precise). Both zones commit
// through the same quantize(step) pipeline — the split changes sensitivity,
// not resolution. Release, keyboard nav, and external value changes ease
// the visual (never the already-committed value) toward the settled
// position on an ease-out-expo tween; raw drag tracks the pointer 1:1 so
// the coincidence is something you visibly chase into alignment. Direct-DOM
// rAF for the tween only (sleeps otherwise); tick highlighting is ordinary
// React state, since it only changes at quantized-value granularity. All
// ink is currentColor via token utility classes — no canvas, no derived hex.
// ---------------------------------------------------------------------------

const FINE_RATIO = 0.9; // vernier pitch = 0.9x coarse pitch — the actual geometry
const MIN_PITCH = 18;
const MAX_PITCH = 56;
const SETTLE_MS = 260;
const H = 84; // svg content height
const COARSE_BASELINE = 15;
const COARSE_TIP_MINOR = 24;
const COARSE_TIP_MAJOR = 30;
const COARSE_LABEL_Y = 8;
const FINE_BASELINE = 68;
const FINE_TIP = 54;
const FINE_LABEL_Y = 78;

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export interface VernierSlipProps {
  /** controlled value; omit for uncontrolled */
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  /** resolution — the fine (vernier) scale reveals exactly this last digit */
  step?: number;
  /** accessible name, also shown as the eyebrow caption */
  label?: string;
  /** unit suffix rendered beside the value, e.g. "mg", "dB" */
  unit?: string;
  /** aria-valuetext override */
  formatValue?: (v: number) => string;
  onValueChange?: (value: number) => void;
  className?: string;
}

export function VernierSlip({
  value,
  defaultValue = 1,
  min = 0,
  max = 10,
  step = 0.1,
  label = "Value",
  unit,
  formatValue,
  onValueChange,
  className = "",
}: VernierSlipProps) {
  const safeStep = step > 0 ? step : 0.1;
  const safeMax = max > min ? max : min + safeStep * 10;
  const decimals = (() => {
    const f = String(safeStep).split(".")[1];
    return f ? f.length : 0;
  })();
  const UNIT = safeStep * 10; // coarse pitch, in value units

  const quantize = (v: number) => {
    const q = min + Math.round((v - min) / safeStep) * safeStep;
    return Number(Math.min(safeMax, Math.max(min, q)).toFixed(6));
  };

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() =>
    quantize(defaultValue)
  );
  const current = isControlled ? quantize(value as number) : internal;
  const currentRef = useRef(current);
  currentRef.current = current;

  const fmtValue =
    formatValue ?? ((v: number) => `${v.toFixed(decimals)}${unit ? ` ${unit}` : ""}`);

  // -- index math: which fine tick lights up, and which main tick it meets --
  const totalSteps = Math.round((current - min) / safeStep);
  const fineIdx = ((totalSteps % 10) + 10) % 10;
  const coarseIdx = (totalSteps - fineIdx) / 10;
  const matchIdx = coarseIdx + fineIdx;

  const totalStepsMax = Math.round((safeMax - min) / safeStep);
  const coarseIdxMax = Math.max(1, Math.ceil(totalStepsMax / 10));
  // +9 padding so the coincidence tick (which can drift up to 9 ticks past
  // the "reading" index) always has a rendered main tick to land on
  const numCoarseTicks = coarseIdxMax + 9;

  const [pitch, setPitch] = useState(32);
  const trackRef = useRef<HTMLDivElement>(null);
  const fineGroupRef = useRef<SVGGElement>(null);
  const hairRef = useRef<SVGLineElement>(null);
  const pointerRef = useRef<SVGLineElement>(null);

  const pitchRef = useRef(pitch);
  pitchRef.current = pitch;
  const matchIdxRef = useRef(matchIdx);
  matchIdxRef.current = matchIdx;
  const fineIdxRef = useRef(fineIdx);
  fineIdxRef.current = fineIdx;

  // fit coarse pitch to the container; falls back to horizontal scroll
  // (track has overflow-x-auto) for domains too wide even at MIN_PITCH
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const fit = (w: number) =>
      Math.min(MAX_PITCH, Math.max(MIN_PITCH, w / Math.max(1, numCoarseTicks)));
    setPitch(fit(track.clientWidth));
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? track.clientWidth;
      setPitch(fit(w));
    });
    ro.observe(track);
    return () => ro.disconnect();
  }, [numCoarseTicks]);

  const commitRef = useRef<(v: number) => void>(() => {});
  commitRef.current = (v: number) => {
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
  };

  const engineRef = useRef<{
    dragStart: (clientX: number, clientY: number) => void;
    dragMove: (clientX: number) => void;
    dragEnd: () => void;
    glideTo: (v: number) => void;
  } | null>(null);

  // -- drag / settle engine: direct DOM, refs only, never React state -------
  useEffect(() => {
    const track = trackRef.current;
    const fineGroup = fineGroupRef.current;
    const hair = hairRef.current;
    const pointer = pointerRef.current;
    if (!track || !fineGroup || !hair || !pointer) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const localQuantize = (v: number) => {
      const q = min + Math.round((v - min) / safeStep) * safeStep;
      return Number(Math.min(safeMax, Math.max(min, q)).toFixed(6));
    };

    let raw = currentRef.current; // continuous, unquantized while dragging
    let visX = 0; // current visual anchor of the fine group, world px
    let targetX = 0;
    let dragging = false;
    let dragMode: "coarse" | "fine" | null = null;
    let dragStartClientX = 0;
    let dragStartValue = 0;
    let raf = 0;
    let tweenStart = 0;
    let tweenFrom = 0;

    const pxPerUnit = () => pitchRef.current / UNIT;
    const xFor = (v: number) => (v - min) * pxPerUnit();

    const render = (x: number) => {
      visX = x;
      fineGroup.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      const finePitch = pitchRef.current * FINE_RATIO;
      const hx2 = x + fineIdxRef.current * finePitch;
      const hx1 = matchIdxRef.current * pitchRef.current;
      hair.setAttribute("x1", hx1.toFixed(2));
      hair.setAttribute("x2", hx2.toFixed(2));
      pointer.setAttribute("x1", x.toFixed(2));
      pointer.setAttribute("x2", x.toFixed(2));
    };

    render(xFor(raw));

    const loop = (now: number) => {
      raf = 0;
      if (dragging) return;
      const t = Math.min(1, (now - tweenStart) / SETTLE_MS);
      render(tweenFrom + (targetX - tweenFrom) * easeOutExpo(t));
      if (t < 1) raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const settleTo = (v: number) => {
      targetX = xFor(v);
      raw = v;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        render(targetX);
        return;
      }
      tweenFrom = visX;
      tweenStart = performance.now();
      wake();
    };

    const dragMove = (clientX: number) => {
      if (!dragging) return;
      const rect = track.getBoundingClientRect();
      let nextRaw: number;
      if (dragMode === "coarse") {
        nextRaw = min + (clientX - rect.left) / pxPerUnit();
      } else {
        const finePitch = pitchRef.current * FINE_RATIO;
        const deltaSteps = (clientX - dragStartClientX) / finePitch;
        nextRaw = dragStartValue + deltaSteps * safeStep;
      }
      nextRaw = Math.min(safeMax, Math.max(min, nextRaw));
      raw = nextRaw;
      render(xFor(raw));
      const q = localQuantize(raw);
      if (q !== currentRef.current) commitRef.current(q);
    };

    const dragStart = (clientX: number, clientY: number) => {
      const rect = track.getBoundingClientRect();
      dragMode = clientY - rect.top < H / 2 ? "coarse" : "fine";
      dragging = true;
      dragStartClientX = clientX;
      dragStartValue = currentRef.current;
      cancelAnimationFrame(raf);
      raf = 0;
      dragMove(clientX);
    };

    const dragEnd = () => {
      if (!dragging) return;
      dragging = false;
      dragMode = null;
      settleTo(currentRef.current);
    };

    const glideTo = (v: number) => {
      if (dragging) return;
      settleTo(v);
    };

    engineRef.current = { dragStart, dragMove, dragEnd, glideTo };

    return () => {
      cancelAnimationFrame(raf);
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, safeMax, safeStep, UNIT]);

  useEffect(() => {
    engineRef.current?.glideTo(current);
  }, [current]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const v = currentRef.current;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = v + safeStep;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = v - safeStep;
        break;
      case "PageUp":
        next = v + UNIT;
        break;
      case "PageDown":
        next = v - UNIT;
        break;
      case "Home":
        next = min;
        break;
      case "End":
        next = safeMax;
        break;
      default:
        return;
    }
    e.preventDefault();
    next = quantize(next);
    if (next !== v) commitRef.current(next);
  };

  const finePitch = pitch * FINE_RATIO;
  const labelStride = pitch < 26 ? 5 : pitch < 40 ? 2 : 1;

  const coarseTicks = useMemo(() => {
    const arr: { i: number; major: boolean; v: number }[] = [];
    for (let i = 0; i <= numCoarseTicks; i++) {
      arr.push({ i, major: i % labelStride === 0, v: min + i * UNIT });
    }
    return arr;
  }, [numCoarseTicks, labelStride, min, UNIT]);

  const fineTicks = useMemo(() => {
    const arr: { k: number }[] = [];
    for (let k = 0; k <= 10; k++) arr.push({ k });
    return arr;
  }, []);

  const svgWidth = numCoarseTicks * pitch;
  const str = current.toFixed(decimals);
  const restStr = decimals > 0 ? str.slice(0, -1) : str;
  const digitStr = decimals > 0 ? str.slice(-1) : "";

  return (
    <div
      className={`w-full max-w-md rounded-md border border-border bg-surface p-4 font-mono ${className}`}
    >
      <div className="flex items-baseline justify-between gap-3 pb-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted">
          {label}
        </span>
        <div className="flex items-baseline gap-1">
          <span
            aria-hidden
            className="text-2xl font-semibold tabular-nums text-foreground"
          >
            {restStr}
            {digitStr ? (
              <span className="text-accent">{digitStr}</span>
            ) : null}
          </span>
          {unit ? (
            <span className="text-xs text-muted">{unit}</span>
          ) : null}
        </div>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin={min}
        aria-valuemax={safeMax}
        aria-valuenow={current}
        aria-valuetext={fmtValue(current)}
        data-vernier-track
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          e.preventDefault();
          trackRef.current?.setPointerCapture(e.pointerId);
          trackRef.current?.focus({ preventScroll: true });
          engineRef.current?.dragStart(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => engineRef.current?.dragMove(e.clientX)}
        onPointerUp={() => engineRef.current?.dragEnd()}
        onPointerCancel={() => engineRef.current?.dragEnd()}
        className="relative block w-full touch-none select-none overflow-x-auto rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <svg
          width={svgWidth}
          height={H}
          className="block cursor-ew-resize"
          aria-hidden
        >
          {/* zone divider — subtle, purely decorative */}
          <line
            x1={0}
            x2={svgWidth}
            y1={H / 2}
            y2={H / 2}
            className="text-border"
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="1 4"
          />

          {/* raw drag position — full-height guide, tracks the pointer 1:1 */}
          <line
            ref={pointerRef}
            y1={0}
            y2={H}
            className="text-foreground/15"
            stroke="currentColor"
            strokeWidth={1}
          />

          {/* coarse row — fixed, never translates */}
          <g>
            {coarseTicks.map(({ i, major, v }) => {
              const x = i * pitch;
              const isMatch = i === matchIdx;
              const tip = isMatch
                ? COARSE_TIP_MAJOR + 4
                : major
                  ? COARSE_TIP_MAJOR
                  : COARSE_TIP_MINOR;
              return (
                <g key={i}>
                  <line
                    x1={x}
                    x2={x}
                    y1={COARSE_BASELINE}
                    y2={tip}
                    className={isMatch ? "text-accent" : "text-foreground/70"}
                    stroke="currentColor"
                    strokeWidth={isMatch ? 2 : 1}
                  />
                  {major && pitch >= 22 ? (
                    <text
                      x={x}
                      y={COARSE_LABEL_Y}
                      textAnchor={x < 6 ? "start" : x > svgWidth - 6 ? "end" : "middle"}
                      className={
                        isMatch
                          ? "fill-accent font-medium"
                          : "fill-muted"
                      }
                      style={{ fontSize: 9 }}
                    >
                      {v.toFixed(Math.max(0, decimals - 1))}
                    </text>
                  ) : null}
                </g>
              );
            })}
            <line
              x1={0}
              x2={svgWidth}
              y1={COARSE_BASELINE}
              y2={COARSE_BASELINE}
              className="text-border"
              stroke="currentColor"
              strokeWidth={1}
            />
          </g>

          {/* connecting hairline — the coincidence, drawn live each frame */}
          <line
            ref={hairRef}
            y1={COARSE_TIP_MAJOR}
            y2={FINE_TIP}
            className="text-accent"
            stroke="currentColor"
            strokeWidth={1.25}
            strokeDasharray="2 2"
          />

          {/* fine (vernier) row — a rigid group that translates as one body */}
          <g ref={fineGroupRef}>
            <line
              x1={0}
              x2={10 * finePitch}
              y1={FINE_BASELINE}
              y2={FINE_BASELINE}
              className="text-border"
              stroke="currentColor"
              strokeWidth={1}
            />
            {fineTicks.map(({ k }) => {
              const x = k * finePitch;
              const isMatch = k === fineIdx;
              return (
                <g key={k}>
                  <line
                    x1={x}
                    x2={x}
                    y1={FINE_BASELINE}
                    y2={isMatch ? FINE_TIP - 4 : FINE_TIP}
                    className={
                      isMatch
                        ? "text-accent"
                        : k <= 9
                          ? "text-foreground/70"
                          : "text-foreground/30"
                    }
                    stroke="currentColor"
                    strokeWidth={isMatch ? 2 : 1}
                  />
                  {k <= 9 ? (
                    <text
                      x={x}
                      y={FINE_LABEL_Y}
                      textAnchor="middle"
                      className={
                        isMatch ? "fill-accent font-semibold" : "fill-muted"
                      }
                      style={{ fontSize: 9 }}
                    >
                      {k}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="flex items-center justify-between pt-2 font-mono text-[10px] text-muted">
        <span>drag body to set · drag scale below to fine-tune</span>
        <span aria-hidden className="tabular-nums">
          {min.toFixed(Math.max(0, decimals - 1))}–{safeMax.toFixed(Math.max(0, decimals - 1))}
        </span>
      </div>
    </div>
  );
}
