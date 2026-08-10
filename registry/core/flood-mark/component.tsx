"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// FloodMark — a threshold authored by dragging through its own history,
// rather than typed blind into a bare number field. The last N daily
// samples plot as a braille dot field: ROWS stacked bands of braille cells
// (4 addressable sub-rows each, via the left column's dots 1/2/3/7) give a
// quantized scatter of where each day actually landed, one dot per day. A
// full-width horizontal rule of "─" glyphs — the flood mark — sits over that
// field at a CONTINUOUS y position (unlike the day dots, which snap to the
// nearest of ROWS*4 slots) and is the entire interactive surface: role=
// slider, draggable anywhere in the field, steppable by keyboard. Every
// day's dot is compared against the rule's live value each render — days
// above it (value > threshold, i.e. "would have alerted") swap from a muted
// single-dot braille glyph to a solid foreground "▴", cross-fading with a
// transition-delay proportional to |value-threshold|/domain, so a big
// threshold move ripples outward from the rule rather than flipping every
// day in lockstep. min/max/step come from the caller's real metric range;
// aria-valuetext carries the whole consequence sentence, not just the raw
// number, and the visible consequence line below doubles as its own
// aria-live=polite region (only actually re-announced when the QUANTIZED
// value changes, so a drag doesn't spam the live region every pixel).
// Faint detent ticks mark the p50/p95/p99 of the same history and both drag
// (soft snap within 2% of domain) and Shift+Arrow (jump to next/prev
// detent) use them. --ns-accent appears in exactly two places, both
// interaction-only: the grab dot while the rule is actively being dragged,
// and the keyboard focus ring — never the resting state, never the flipped
// "▴" marks (those stay --foreground, matching the brief's own wording).
// DOM+CSS only, no canvas: every dot is a real braille character, tokens
// only (--background/--foreground/--ns-muted/--border/--ns-accent).
// ---------------------------------------------------------------------------

const ROWS = 8;
// left-column braille dots 1,2,3,7 top-to-bottom — the 4 addressable
// sub-row bits inside one braille cell (U+2800 + bits, per the standard
// 2-wide x 4-tall dot layout).
const SUBROW_BIT = [0x01, 0x02, 0x04, 0x40] as const;
const BLANK = "⠀"; // empty braille pattern, reserves the column's width
const RIPPLE_STEP_MS = 30;
const RIPPLE_MAX_MS = 240;
const SNAP_FRAC = 0.02; // fraction of the domain a drag snaps into a detent within
const FIELD_H = 132; // px

export interface FloodMarkProps {
  /** daily samples, oldest first — the field below the rule; ~30 is the intended read */
  history: number[];
  /** controlled threshold; omit for uncontrolled */
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** metric domain floor (default: min(0, min(history))) */
  min?: number;
  /** metric domain ceiling (default: a little above the data's own max) */
  max?: number;
  /** quantization step (default: a coarse guess from the domain — pass a real one) */
  step?: number;
  /** unit suffix, e.g. "ms", "%", "req/s" */
  unit?: string;
  /** what's being thresholded, e.g. "p99 latency" */
  label?: string;
  className?: string;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
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

export function FloodMark({
  history,
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  step,
  unit = "ms",
  label = "Threshold",
  className = "",
}: FloodMarkProps) {
  const uid = useId();
  const reduced = useReducedMotion();
  const series = history.length ? history : [0];

  const dataMin = Math.min(...series);
  const dataMax = Math.max(...series);
  const safeMin = min ?? Math.min(0, dataMin);
  const safeMax = max !== undefined ? max : Math.max(dataMax * 1.15, dataMax + 1);
  const domain = Math.max(1e-6, safeMax - safeMin);
  const safeStep = step && step > 0 ? step : Math.max(1, Math.round(domain / 100));

  const quantize = (v: number) => {
    const q = safeMin + Math.round((v - safeMin) / safeStep) * safeStep;
    return clamp(Number(q.toFixed(4)), safeMin, safeMax);
  };

  const sorted = useMemo(() => [...series].sort((a, b) => a - b), [series]);
  const detents = useMemo(() => {
    const raw = [percentile(sorted, 50), percentile(sorted, 95), percentile(sorted, 99)];
    return Array.from(new Set(raw.map((v) => Number(v.toFixed(4))))).sort((a, b) => a - b);
  }, [sorted]);

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() =>
    quantize(defaultValue ?? detents[detents.length - 1] ?? safeMin)
  );
  const current = isControlled ? quantize(value as number) : internal;
  const currentRef = useRef(current);
  currentRef.current = current;

  const commit = (v: number) => {
    const q = quantize(v);
    if (q === currentRef.current) return;
    if (!isControlled) setInternal(q);
    onValueChange?.(q);
  };

  const percentFor = (v: number) => clamp((1 - (v - safeMin) / domain) * 100, 0, 100);

  const points = useMemo(
    () =>
      series.map((v, i) => {
        const frac = clamp((v - safeMin) / domain, 0, 1);
        const totalSlots = ROWS * 4;
        const slot = Math.round((1 - frac) * (totalSlots - 1));
        return { i, v, rowIdx: Math.floor(slot / 4), subRow: slot % 4 };
      }),
    [series, safeMin, domain]
  );

  const rulePercent = percentFor(current);
  const fireCount = series.filter((v) => v > current).length;
  const weeks = useMemo(() => {
    const chunks: number[][] = [];
    for (let i = 0; i < series.length; i += 7) chunks.push(series.slice(i, i + 7));
    return chunks.map((chunk) => chunk.filter((v) => v > current).length);
  }, [series, current]);

  const weekLabel = weeks.map((c, i) => `wk${i + 1} ${c}`).join(" · ");
  const consequence = `would have fired ${fireCount} time${fireCount === 1 ? "" : "s"} last month — ${weekLabel}`;
  const valueText = `threshold ${fmt(current)}${unit}, ${fireCount} alert${fireCount === 1 ? "" : "s"} in the last 30 days`;

  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const valueFromClientY = (clientY: number) => {
    const el = trackRef.current;
    if (!el) return currentRef.current;
    const rect = el.getBoundingClientRect();
    const frac = clamp((clientY - rect.top) / Math.max(1, rect.height), 0, 1);
    let raw = safeMax - frac * domain;
    for (const d of detents) {
      if (Math.abs(raw - d) <= domain * SNAP_FRAC) {
        raw = d;
        break;
      }
    }
    return raw;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    draggingRef.current = true;
    setDragging(true);
    commit(valueFromClientY(e.clientY));
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    commit(valueFromClientY(e.clientY));
  };
  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
  };

  const jumpDetent = (dir: 1 | -1) => {
    const v = currentRef.current;
    const next =
      dir > 0
        ? detents.find((d) => d > v + 1e-6)
        : [...detents].reverse().find((d) => d < v - 1e-6);
    commit(next !== undefined ? next : v + dir * safeStep);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const v = currentRef.current;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      if (e.shiftKey) jumpDetent(1);
      else commit(v + safeStep);
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      if (e.shiftKey) jumpDetent(-1);
      else commit(v - safeStep);
    } else if (e.key === "Home") {
      e.preventDefault();
      commit(safeMin);
    } else if (e.key === "End") {
      e.preventDefault();
      commit(safeMax);
    }
  };

  const labelId = `${uid}-label`;

  return (
    <div className={`w-full ${className}`}>
      <style>{`
.ns-flood-glyph{transition-property:opacity;transition-duration:150ms;transition-timing-function:ease-out}
@media (prefers-reduced-motion: reduce){
  .ns-flood-glyph{transition:none !important}
}
`}</style>

      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="font-mono text-[11px] tracking-wide text-ns-muted">
          {label.toUpperCase()}
        </span>
        <span className="font-mono text-[11px] text-ns-muted">last {series.length} days</span>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-orientation="vertical"
        aria-labelledby={labelId}
        aria-valuemin={safeMin}
        aria-valuemax={safeMax}
        aria-valuenow={current}
        aria-valuetext={valueText}
        data-flood-rule
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        style={{ height: `${FIELD_H}px` }}
        className="group relative mt-2 block w-full touch-none select-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {/* the sparkline field — decorative; the slider node above carries the semantics */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid font-mono text-[13px] leading-none"
          style={{ gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
        >
          {Array.from({ length: ROWS }, (_, r) => (
            <div key={r} className="flex items-center">
              {points.map(({ i, v, rowIdx, subRow }) => {
                if (rowIdx !== r) {
                  return (
                    <span key={i} className="flex-1 text-center text-ns-muted/0">
                      {BLANK}
                    </span>
                  );
                }
                const wet = v > current;
                const distFrac = Math.abs(v - current) / domain;
                const delayMs = reduced
                  ? 0
                  : Math.min(RIPPLE_MAX_MS, Math.round(distFrac * ROWS) * RIPPLE_STEP_MS);
                const dotChar = String.fromCharCode(0x2800 + SUBROW_BIT[subRow]);
                return (
                  <span key={i} className="relative flex-1 text-center">
                    <span
                      className="ns-flood-glyph absolute inset-x-0 text-ns-muted"
                      style={{ opacity: wet ? 0 : 1, transitionDelay: `${delayMs}ms` }}
                    >
                      {dotChar}
                    </span>
                  </span>
                );
              })}
            </div>
          ))}
        </div>

        {/* the flipped days. Drawn in their OWN layer at the day's EXACT
            value position — the same continuous mapping the rule uses —
            rather than inside the braille band that carries the resting dot.
            The band quantizes to ROWS*4 slots and its glyph ink sits wherever
            the font puts it, which is up to half a band away: drawing the mark
            there put a solid "above the line" triangle visibly BELOW the line
            for any day within ~8px of the threshold (seen in the gate's own
            resting screenshot). Marks positioned by percentFor() are on the
            correct side of the rule by construction. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 font-mono text-[13px] leading-none">
          {points.map(({ i, v }) => {
            const wet = v > current;
            const distFrac = Math.abs(v - current) / domain;
            const delayMs = reduced
              ? 0
              : Math.min(RIPPLE_MAX_MS, Math.round(distFrac * ROWS) * RIPPLE_STEP_MS);
            return (
              <span
                key={i}
                className="ns-flood-glyph absolute text-foreground"
                style={{
                  left: `${((i + 0.5) / points.length) * 100}%`,
                  top: `${percentFor(v)}%`,
                  transform: "translate(-50%, -50%)",
                  opacity: wet ? 1 : 0,
                  transitionDelay: `${delayMs}ms`,
                }}
              >
                ▴
              </span>
            );
          })}
        </div>

        {/* percentile detent ticks — decorative snap targets, p50/p95/p99 */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 -left-2 w-2">
          {detents.map((d) => (
            <span
              key={d}
              className="absolute left-0 h-px w-2 bg-ns-muted/50"
              style={{ top: `${percentFor(d)}%` }}
            />
          ))}
        </div>

        {/* the flood mark — a full-width row of dashes riding a live position */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 items-center gap-1"
          style={{ top: `${rulePercent}%` }}
        >
          <span
            className={
              "font-mono text-xs leading-none transition-colors duration-150 " +
              (dragging ? "text-ns-accent" : "text-foreground")
            }
          >
            ●
          </span>
          <span className="flex-1 overflow-hidden whitespace-nowrap font-mono text-xs leading-none text-foreground/80 transition-colors duration-150 group-hover:text-foreground">
            {"─".repeat(200)}
          </span>
          <span className="shrink-0 rounded-sm border border-border bg-background px-1 py-0.5 font-mono text-[10px] tabular-nums text-foreground">
            {fmt(current)}
            {unit}
          </span>
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        className="mt-2 font-mono text-[11px] leading-relaxed text-ns-muted"
      >
        {consequence}
      </p>
    </div>
  );
}
