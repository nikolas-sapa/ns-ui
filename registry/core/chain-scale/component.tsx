"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ChainScale — a map zoom control that IS the scale bar. One governing
// scalar, metersPerPixel, drives everything: the bar's rendered length is
// denom/metersPerPixel, where denom is the LARGEST value from the 1-2-5
// preferred series (…100 200 500 1000…) whose length still fits maxWidth.
// The printed distance is therefore always a sayable round number, never the
// raw drag value — because the formula is continuous in metersPerPixel while
// the ladder is discrete, the bar keeps growing under the pointer with its
// OLD label still attached, right up until the next rung overtakes it, at
// which instant the denomination jumps and the bar visibly snaps to the new
// fraction of maxWidth. That snap is the one thing worth animating: a 180ms
// ease-out-expo width spring plus a 1px tick flash mark the detent, while
// every other frame — ordinary dragging within one denomination — tracks
// the pointer with zero added lag. Dragging maps handle dx to
// metersPerPixel in LOG space (linear would make a city-to-street zoom take
// a hundred screens of drag). Wheel over the control walks the same log
// mapping; arrow keys step exactly one ladder rung (an inherent detent);
// double-click resets to the nearest rung where the bar sits at 3/4 of
// maxWidth. Only the animated pixel geometry (bar width, handle x, end
// label x) is ever written imperatively via refs/rAF; block COUNT and fill
// pattern are ordinary React state, since they only change at rung
// granularity — so a crossing shows the new block count immediately while
// the container that holds it is still springing to size. DOM + CSS only,
// no canvas; every ink value is a CSS custom property, never a literal.
// ---------------------------------------------------------------------------

const MANTISSAS = [1, 2, 5] as const;
const MIN_EXP = -2; // 0.01 m floor denomination
const MAX_EXP = 7; // 10,000,000 m ceiling denomination
const SPRING_MS = 180;
const WHEEL_LOG_STEP = 0.12;
const DRAG_LOG_PER_PX = 0.01;
const BAR_H = 10;
const HANDLE_W = 10;
const LABEL_ROW_TOP = BAR_H + 6;

interface Rung {
  v: number; // denomination, in metres
  mant: 1 | 2 | 5;
}

function buildLadder(): Rung[] {
  const out: Rung[] = [];
  for (let e = MIN_EXP; e <= MAX_EXP; e++) {
    for (const mant of MANTISSAS) {
      out.push({ v: Number((mant * Math.pow(10, e)).toPrecision(6)), mant });
    }
  }
  return out;
}
const LADDER = buildLadder();

function blocksForMant(mant: 1 | 2 | 5): number {
  return mant === 1 ? 2 : mant;
}

function formatShort(v: number): string {
  if (v < 1) return `${Math.round(v * 100)} cm`;
  if (v < 1000) return `${v} m`;
  return `${v / 1000} km`;
}

function formatWords(v: number): string {
  if (v < 1) return `${Math.round(v * 100)} centimetres`;
  if (v < 1000) return `${v} metres`;
  return `${v / 1000} kilometres`;
}

function formatPerPixel(m: number): string {
  if (m < 1) return `${(m * 100).toFixed(0)} cm`;
  if (m < 10) return `${m.toFixed(1)} m`;
  return `${Math.round(m)} m`;
}

// largest rung whose bar (rung.v / m) still fits maxWidthPx — the whole
// falsifiable contract in one function.
function pickIndex(m: number, maxWidthPx: number): number {
  let idx = 0;
  for (let i = 0; i < LADDER.length; i++) {
    if (LADDER[i].v / m <= maxWidthPx) idx = i;
    else break;
  }
  return idx;
}

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export interface ChainScaleProps {
  /** controlled metres-per-pixel; omit for uncontrolled */
  metersPerPixel?: number;
  /** uncontrolled initial metres-per-pixel */
  defaultMetersPerPixel?: number;
  /** most-zoomed-in bound (smallest metersPerPixel) */
  minMetersPerPixel?: number;
  /** most-zoomed-out bound (largest metersPerPixel) */
  maxMetersPerPixel?: number;
  /** pixel budget the bar is never allowed to exceed */
  maxWidth?: number;
  /** accessible name */
  label?: string;
  /** stable id; the live description renders at `${id}-desc` so a host map
   *  region can point its own aria-describedby at it */
  id?: string;
  /** fires with the new metres-per-pixel on every change — wire this to a map's zoom */
  onValueChange?: (metersPerPixel: number) => void;
  /** extra classes merged onto the root element */
  className?: string;
}

export function ChainScale({
  metersPerPixel,
  defaultMetersPerPixel = 1,
  minMetersPerPixel = 0.02,
  maxMetersPerPixel = 20000,
  maxWidth = 200,
  label = "Map scale",
  id,
  onValueChange,
  className = "",
}: ChainScaleProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const descId = id ? `${id}-desc` : `chain-scale-desc-${uid}`;

  const clamp = (v: number) =>
    Math.min(maxMetersPerPixel, Math.max(minMetersPerPixel, v));

  const isControlled = metersPerPixel !== undefined;
  const [internal, setInternal] = useState(() => clamp(defaultMetersPerPixel));
  const m = isControlled ? clamp(metersPerPixel as number) : internal;
  const mRef = useRef(m);
  mRef.current = m;

  const commitRef = useRef<(v: number) => void>(() => {});
  commitRef.current = (v: number) => {
    const c = clamp(v);
    if (!isControlled) setInternal(c);
    onValueChange?.(c);
  };

  const index = useMemo(() => pickIndex(m, maxWidth), [m, maxWidth]);
  // pickIndex(m, .) is monotonic in m, so the reachable index band is just
  // the two clamp bounds run through it — the full LADDER is padded far
  // past what min/maxMetersPerPixel can ever select, so those raw bounds
  // would advertise a range the slider can't actually reach.
  const minIndex = useMemo(
    () => pickIndex(minMetersPerPixel, maxWidth),
    [minMetersPerPixel, maxWidth]
  );
  const maxIndex = useMemo(
    () => pickIndex(maxMetersPerPixel, maxWidth),
    [maxMetersPerPixel, maxWidth]
  );
  const rung = LADDER[index];
  const blocks = blocksForMant(rung.mant);
  const shortLabel = formatShort(rung.v);
  const wordsLabel = formatWords(rung.v);
  const perPixel = formatPerPixel(m);
  const sentence = `Scale: ${wordsLabel}. 1 pixel equals ${perPixel}.`;
  const valueText = `${shortLabel} — 1px = ${perPixel}`;

  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const endLabelRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(index);

  const engineRef = useRef<{
    applyFromM: (mv: number) => void;
    dragStart: (clientX: number) => void;
    dragMove: (clientX: number) => void;
    dragEnd: () => void;
  } | null>(null);

  // -- imperative geometry engine: direct DOM writes, refs only ------------
  useLayoutEffect(() => {
    const track = trackRef.current;
    const bar = barRef.current;
    const handle = handleRef.current;
    const endLabel = endLabelRef.current;
    const tick = tickRef.current;
    if (!track || !bar || !handle || !endLabel || !tick) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let visWidth = Math.min(
      maxWidth,
      LADDER[indexRef.current].v / mRef.current
    );
    let targetWidth = visWidth;
    let raf = 0;
    let tweenFrom = visWidth;
    let tweenStart = 0;
    let springing = false;
    let dragging = false;
    let dragStartClientX = 0;
    let dragStartLogM = 0;

    const place = (px: number) => {
      visWidth = px;
      bar.style.width = `${px}px`;
      handle.style.transform = `translate3d(${(px - HANDLE_W / 2).toFixed(2)}px,0,0)`;
      endLabel.style.transform = `translate3d(${px.toFixed(2)}px,0,0) translateX(-100%)`;
    };
    place(visWidth);

    const flashTick = (px: number) => {
      tick.style.left = `${px.toFixed(2)}px`;
      tick.style.animation = "none";
      void tick.offsetWidth; // force reflow so re-adding the class restarts it
      tick.style.animation = "";
    };

    const loop = (now: number) => {
      raf = 0;
      const t = Math.min(1, (now - tweenStart) / SPRING_MS);
      place(tweenFrom + (targetWidth - tweenFrom) * easeOutExpo(t));
      if (t < 1) raf = requestAnimationFrame(loop);
      else springing = false;
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const applyFromM = (mv: number) => {
      const idx = pickIndex(mv, maxWidth);
      const crossed = idx !== indexRef.current;
      indexRef.current = idx;
      const target = Math.min(maxWidth, LADDER[idx].v / mv);
      targetWidth = target;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        springing = false;
        place(target);
        return;
      }
      if (crossed) {
        tweenFrom = visWidth;
        tweenStart = performance.now();
        springing = true;
        flashTick(target);
        wake();
      } else if (!springing) {
        place(target);
      }
    };

    const dragMove = (clientX: number) => {
      if (!dragging) return;
      const dx = clientX - dragStartClientX;
      const nextM = clamp(Math.exp(dragStartLogM - dx * DRAG_LOG_PER_PX));
      applyFromM(nextM);
      commitRef.current(nextM);
    };

    const dragStart = (clientX: number) => {
      dragging = true;
      dragStartClientX = clientX;
      dragStartLogM = Math.log(mRef.current);
    };

    const dragEnd = () => {
      dragging = false;
    };

    // React binds `wheel` passively on the root, so a synthetic onWheel
    // prop can never preventDefault (Chrome logs and the page scrolls
    // under the drag) — bind a real non-passive listener here instead.
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1; // scroll down -> zoom out
      const nextM = clamp(
        Math.exp(Math.log(mRef.current) + dir * WHEEL_LOG_STEP)
      );
      applyFromM(nextM);
      commitRef.current(nextM);
    };
    track.addEventListener("wheel", onWheelNative, { passive: false });

    engineRef.current = { applyFromM, dragStart, dragMove, dragEnd };

    return () => {
      cancelAnimationFrame(raf);
      track.removeEventListener("wheel", onWheelNative);
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxWidth, minMetersPerPixel, maxMetersPerPixel]);

  useLayoutEffect(() => {
    engineRef.current?.applyFromM(m);
  }, [m]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp": {
        e.preventDefault();
        const nextIndex = Math.min(LADDER.length - 1, index + 1);
        // *(1+1e-9): landing exactly on v/maxWidth is a round-trip
        // division that pickIndex re-derives from m — floating-point
        // noise can land it one ULP over and read back the rung BELOW,
        // so the arrow silently no-ops at certain widths. Nudge just
        // inside the rung; ladder steps are all >=1.6x apart so this
        // never bleeds into a neighbor.
        const nextM = clamp((LADDER[nextIndex].v / maxWidth) * (1 + 1e-9));
        if (nextM !== mRef.current) commitRef.current(nextM);
        return;
      }
      case "ArrowLeft":
      case "ArrowDown": {
        e.preventDefault();
        const nextIndex = Math.max(0, index - 1);
        const nextM = clamp((LADDER[nextIndex].v / maxWidth) * (1 + 1e-9));
        if (nextM !== mRef.current) commitRef.current(nextM);
        return;
      }
      case "Home":
        // jump to the min/max SCALE (the props), not the full 0.01m-10Mm
        // ladder — the ladder is padded far past what min/maxMetersPerPixel
        // can ever reach, so indexing into it directly would advertise and
        // land on a rung the control can never otherwise show.
        e.preventDefault();
        if (minMetersPerPixel !== mRef.current)
          commitRef.current(minMetersPerPixel);
        return;
      case "End":
        e.preventDefault();
        if (maxMetersPerPixel !== mRef.current)
          commitRef.current(maxMetersPerPixel);
        return;
      default:
        return;
    }
  };

  const onDoubleClick = () => {
    const nextM = clamp(rung.v / (0.75 * maxWidth));
    commitRef.current(nextM);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    trackRef.current?.setPointerCapture(e.pointerId);
    trackRef.current?.focus({ preventScroll: true });
    engineRef.current?.dragStart(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    engineRef.current?.dragMove(e.clientX);
  };
  const onPointerUp = () => engineRef.current?.dragEnd();
  const onPointerCancel = () => engineRef.current?.dragEnd();

  return (
    <div
      className={`inline-flex flex-col items-start gap-2 rounded-md border border-border bg-background p-3 font-mono ${className}`}
    >
      <style>{`
.chain-scale-slider:hover .chain-scale-handle,
.chain-scale-slider:focus-visible .chain-scale-handle,
.chain-scale-slider:active .chain-scale-handle {
  background-color: var(--ns-accent);
  border-color: var(--ns-accent);
}
.chain-scale-handle {
  transition: background-color 150ms ease-out, border-color 150ms ease-out;
}
.chain-scale-tick {
  animation: chain-scale-tick-flash 380ms ease-out;
}
@keyframes chain-scale-tick-flash {
  0% { opacity: 1; }
  100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .chain-scale-tick { animation: none !important; opacity: 0 !important; }
  .chain-scale-handle { transition: none !important; }
}
`}</style>

      <span className="select-none text-[10px] uppercase tracking-[0.2em] text-ns-muted">
        {label}
      </span>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin={minIndex}
        aria-valuemax={maxIndex}
        aria-valuenow={index}
        aria-valuetext={valueText}
        aria-describedby={descId}
        data-chain-scale-slider
        onKeyDown={onKeyDown}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className="chain-scale-slider relative block cursor-ew-resize touch-none select-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{ width: maxWidth, height: LABEL_ROW_TOP + 14 }}
      >
        {/* checkerboard bar — presentational; the wrapper above carries the value */}
        <div
          ref={barRef}
          aria-hidden
          className="absolute left-0 top-0 flex overflow-hidden rounded-[2px] border border-border"
          style={{ height: BAR_H }}
        >
          {Array.from({ length: blocks }).map((_, i) => (
            <div
              key={i}
              className="h-full flex-1"
              style={{
                backgroundColor: i % 2 === 0 ? "var(--foreground)" : "transparent",
                borderRight: i < blocks - 1 ? "1px solid var(--border)" : "none",
              }}
            />
          ))}
        </div>

        {/* detent tick — flashes on each ladder crossing, positioned by the engine */}
        <div
          ref={tickRef}
          aria-hidden
          className="chain-scale-tick absolute w-px bg-foreground opacity-0"
          style={{ top: -2, height: BAR_H + 4 }}
        />

        {/* "0" — the only numeral besides the end label; no interior numerals */}
        <span
          aria-hidden
          className="absolute select-none text-[10px] text-ns-muted"
          style={{ left: 0, top: LABEL_ROW_TOP }}
        >
          0
        </span>

        {/* end label — tracks the animated bar edge via the engine */}
        <div
          ref={endLabelRef}
          aria-hidden
          className="absolute select-none whitespace-nowrap text-[10px] text-foreground"
          style={{ top: LABEL_ROW_TOP }}
        >
          {shortLabel}
        </div>

        {/* grab handle — the only element allowed --ns-accent, and only on interaction */}
        <div
          ref={handleRef}
          aria-hidden
          className="chain-scale-handle absolute rounded-full border border-foreground bg-background"
          style={{ top: -2, width: HANDLE_W, height: BAR_H + 4 }}
        />
      </div>

      <p id={descId} aria-live="polite" aria-atomic="true" className="sr-only">
        {sentence}
      </p>
    </div>
  );
}
