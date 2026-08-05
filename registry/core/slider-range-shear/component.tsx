"use client";

import { useLayoutEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ShearBand — dual-handle range slider whose selected span is a taut band of
// material rather than two disconnected thumbs. The band is an SVG <polygon>
// between the min/max grips, not a plain rect: while a grip drags, the
// pointer's instantaneous velocity drives a clamped px "lean" applied ONLY to
// the two corners of the dragged (near) edge — offset in opposite directions,
// top one way and bottom the other — while the far edge's two corners stay
// pinned at its exact x. That's a deliberate departure from a literal CSS
// skewX(): skewX shears every row by the same amount regardless of x, so it
// cannot keep one vertical edge stationary while the other leans — at any
// magnitude big enough to actually see, a symmetric skew would drag the far
// edge visibly off the planted grip, which reads as broken, not as tension.
// Four independently-placed polygon corners can pin one edge exactly while
// the other one leans, which is what "shears under velocity, far thumb
// stays planted" actually requires. Release relaxes the lean back to 0 on an
// underdamped spring (~1.5 visible oscillations) rather than snapping flat.
//
// A11y is carried entirely by two real <input type="range"> (min/max),
// visually hidden (sr-only, not display:none) so Tab reaches both and native
// arrow/Home/End/PageUp/PageDown handling comes for free. Each input's own
// min/max attribute is clamped to the OTHER thumb's current value (minInput's
// max = current hi, maxInput's min = current lo) so keyboard input can never
// cross the thumbs — no custom keydown handler needed. aria-valuetext names
// the other bound so a screen reader hears "minimum, 40 of maximum 200"
// rather than a bare number. The lean is presentation-only: it never touches
// the committed value and is skipped entirely under prefers-reduced-motion
// (positions still update, just without the lean or the release spring).
//
// Pointer interaction lives on the shared root, not on the (invisible)
// inputs — a pointerdown picks whichever grip's pixel position is nearer the
// click (ties resolve toward whichever grip the pointer sits outside of),
// then focuses that grip's real input so keyboard nav can continue from
// there. That proximity arbitration is what makes overlapping/touching
// thumbs (a zero-width span) pickable on touch, where there's no hover to
// disambiguate first.
// ---------------------------------------------------------------------------

const PAD = 14; // px inset so grips/labels never clip at the track ends
const BAND_H = 14; // px height of the material band
const TRACK_Y = 40; // px vertical center of the track/grips within the root
const ROOT_H = 56; // px total component height (label row + track row)
const LEAN_MAX_PX = 8; // max near-edge corner offset (top and bottom, opposite signs)
const VEL_TO_LEAN = 0.09; // px of lean per px/s of pointer velocity, pre-clamp
const LEAN_SMOOTH = 0.5; // per-event lerp toward the velocity-derived target
const SPRING_K = 300; // s^-2, release spring back to 0
const SPRING_ZETA = 0.22; // underdamped -> ~1.5 visible oscillations before rest

type Thumb = "lo" | "hi";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface ShearBandProps {
  min?: number;
  max?: number;
  step?: number;
  /** controlled [min, max] value; omit for uncontrolled */
  value?: [number, number];
  defaultValue?: [number, number];
  onValueChange?: (value: [number, number]) => void;
  /** formats a bound for both the printed readout and aria-valuetext */
  formatValue?: (v: number) => string;
  /** accessible name for the lower-bound input */
  minLabel?: string;
  /** accessible name for the upper-bound input */
  maxLabel?: string;
  className?: string;
}

export function ShearBand({
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue = [25, 75],
  onValueChange,
  formatValue,
  minLabel = "Minimum value",
  maxLabel = "Maximum value",
  className = "",
}: ShearBandProps) {
  const isControlled = value !== undefined;
  const [loState, setLoState] = useState(() => clamp(defaultValue[0], min, max));
  const [hiState, setHiState] = useState(() => clamp(defaultValue[1], min, max));
  const lo = isControlled ? value[0] : loState;
  const hi = isControlled ? value[1] : hiState;
  const loRef = useRef(lo);
  loRef.current = lo;
  const hiRef = useRef(hi);
  hiRef.current = hi;

  const fmt = formatValue ?? ((v: number) => (step % 1 !== 0 ? v.toFixed(2) : String(Math.round(v))));
  const fmtRef = useRef(fmt);
  fmtRef.current = fmt;

  const [activeThumb, setActiveThumb] = useState<Thumb | null>(null);
  const [focusedThumb, setFocusedThumb] = useState<Thumb | null>(null);
  const [trackW, setTrackW] = useState(0);
  // lean: signed px offset applied to the dragged edge's corners; shearSide:
  // which edge is currently "near" (the other stays planted). Both are React
  // state — position changes already re-render on every quantized pointermove,
  // so driving the lean through state too costs nothing extra and keeps a
  // single source of truth instead of a parallel imperative path.
  const [lean, setLean] = useState(0);
  const [shearSide, setShearSide] = useState<Thumb | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const minInputRef = useRef<HTMLInputElement>(null);
  const maxInputRef = useRef<HTMLInputElement>(null);

  const activeRef = useRef<Thumb | null>(null);
  const reducedRef = useRef(false);
  const rafRef = useRef(0);
  const leanRef = useRef(0);
  const leanVelRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTRef = useRef(0);

  // live width of the track/grip row — measured, not assumed, so PAD-relative
  // positions stay exact across container resizes
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setTrackW(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const xFor = (v: number, w: number) => {
    const frac = clamp((v - min) / (max - min || 1e-9), 0, 1);
    return PAD + frac * Math.max(1, w - PAD * 2);
  };
  const valueFromX = (x: number, w: number) => {
    const usable = Math.max(1, w - PAD * 2);
    const frac = clamp((x - PAD) / usable, 0, 1);
    return min + frac * (max - min);
  };
  const quantize = (v: number) => {
    const stepped = min + Math.round((v - min) / step) * step;
    return Number(clamp(stepped, min, max).toFixed(6));
  };

  const commit = (which: Thumb, v: number) => {
    const nextLo = which === "lo" ? v : loRef.current;
    const nextHi = which === "hi" ? v : hiRef.current;
    if (nextLo === loRef.current && nextHi === hiRef.current) return;
    loRef.current = nextLo;
    hiRef.current = nextHi;
    if (!isControlled) {
      setLoState(nextLo);
      setHiState(nextHi);
    }
    onValueChange?.([nextLo, nextHi]);
  };

  // proximity arbitration: whichever grip's pixel position is nearer the
  // pointer wins; an exact tie (thumbs coincident, or click sits precisely at
  // the midpoint) extends outward in whichever direction the pointer already
  // sits past the shared span, else defaults to the lower bound — this is
  // what makes a zero-width (touching) span still pickable on touch
  const pickThumb = (x: number, loPx: number, hiPx: number): Thumb => {
    const dLo = Math.abs(x - loPx);
    const dHi = Math.abs(x - hiPx);
    if (dLo !== dHi) return dLo < dHi ? "lo" : "hi";
    if (x < loPx) return "lo";
    if (x > hiPx) return "hi";
    return "lo";
  };

  const moveActiveTo = (which: Thumb, x: number, w: number) => {
    let v = quantize(valueFromX(x, w));
    if (which === "lo") v = Math.min(v, hiRef.current);
    else v = Math.max(v, loRef.current);
    commit(which, v);
  };

  const startSpring = () => {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, Math.max(0, (now - last) / 1000));
      last = now;
      const c = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
      leanVelRef.current += (-SPRING_K * leanRef.current - c * leanVelRef.current) * dt;
      leanRef.current += leanVelRef.current * dt;
      if (Math.abs(leanRef.current) < 0.05 && Math.abs(leanVelRef.current) < 1) {
        leanRef.current = 0;
        leanVelRef.current = 0;
        setLean(0);
        rafRef.current = 0;
        return;
      }
      setLean(leanRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const root = e.currentTarget;
    const rect = root.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const which = pickThumb(x, xFor(loRef.current, rect.width), xFor(hiRef.current, rect.width));
    activeRef.current = which;
    setActiveThumb(which);
    setShearSide(which);
    root.setPointerCapture(e.pointerId);
    (which === "lo" ? minInputRef : maxInputRef).current?.focus({ preventScroll: true });
    lastXRef.current = x;
    lastTRef.current = performance.now();
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    leanRef.current = 0;
    leanVelRef.current = 0;
    setLean(0);
    moveActiveTo(which, x, rect.width);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const which = activeRef.current;
    if (!which) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    moveActiveTo(which, x, rect.width);
    const now = performance.now();
    const dt = Math.max(1, now - lastTRef.current) / 1000;
    const dx = x - lastXRef.current;
    lastXRef.current = x;
    lastTRef.current = now;
    if (!reducedRef.current) {
      const vel = dx / dt;
      const target = clamp(vel * VEL_TO_LEAN, -LEAN_MAX_PX, LEAN_MAX_PX);
      leanRef.current += (target - leanRef.current) * LEAN_SMOOTH;
      setLean(leanRef.current);
    }
  };

  const endDrag = () => {
    if (!activeRef.current) return;
    activeRef.current = null;
    setActiveThumb(null);
    if (!reducedRef.current && Math.abs(leanRef.current) > 0.01) {
      startSpring();
    } else {
      leanRef.current = 0;
      setLean(0);
    }
  };

  const onFocusVisible = (which: Thumb) => (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.matches(":focus-visible")) setFocusedThumb(which);
  };
  const onBlurThumb = (which: Thumb) => () => {
    setFocusedThumb((f) => (f === which ? null : f));
  };

  const loPx = xFor(lo, trackW);
  const hiPx = xFor(hi, trackW);
  const loEngaged = activeThumb === "lo" || focusedThumb === "lo";
  const hiEngaged = activeThumb === "hi" || focusedThumb === "hi";

  // pinned-edge trapezoid: the far edge's top+bottom corners share one x (the
  // planted grip), the near (dragged) edge's corners split by +-lean — clamped
  // to a fraction of the current span so a near-zero gap can't self-cross
  const span = Math.max(0, hiPx - loPx);
  const effLean = shearSide ? clamp(lean, -span * 0.9, span * 0.9) : 0;
  const bandPoints =
    shearSide === "lo"
      ? `${loPx + effLean},0 ${hiPx},0 ${hiPx},${BAND_H} ${loPx - effLean},${BAND_H}`
      : shearSide === "hi"
        ? `${loPx},0 ${hiPx + effLean},0 ${hiPx - effLean},${BAND_H} ${loPx},${BAND_H}`
        : `${loPx},0 ${hiPx},0 ${hiPx},${BAND_H} ${loPx},${BAND_H}`;

  const gripStyle = (px: number, engaged: boolean): React.CSSProperties => ({
    transform: `translate3d(${px}px, ${TRACK_Y}px, 0) translate(-50%, -50%)`,
    height: engaged ? 26 : 20,
    width: engaged ? 3 : 2,
    backgroundColor: "var(--foreground)",
    opacity: engaged ? 1 : 0.55,
    boxShadow: engaged
      ? "0 1px 2px 0 color-mix(in srgb, var(--foreground) 45%, transparent)"
      : "none",
  });

  return (
    <div className={`relative w-full font-mono ${className}`} style={{ height: ROOT_H }}>
      <div
        ref={rootRef}
        data-slider-range-shear-track
        className="relative h-full w-full touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* printed values, Geist Mono, sliding with their grip */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 whitespace-nowrap text-xs tabular-nums text-foreground transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(${loPx}px) translateX(-50%)` }}
        >
          {fmt(lo)}
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 whitespace-nowrap text-xs tabular-nums text-foreground transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(${hiPx}px) translateX(-50%)` }}
        >
          {fmt(hi)}
        </span>

        {/* hairline base track */}
        <div
          aria-hidden
          className="pointer-events-none absolute h-px"
          style={{ left: PAD, right: PAD, top: TRACK_Y, backgroundColor: "var(--border)" }}
        />

        {/* the band — a real SVG polygon, the taut material between the
            grips. Its far edge (opposite whichever grip is dragging) is
            pinned to an exact x; only the near edge's corners lean */}
        <svg
          aria-hidden
          className="pointer-events-none absolute left-0 overflow-visible"
          width={trackW}
          height={BAND_H}
          style={{ top: TRACK_Y - BAND_H / 2 }}
        >
          <polygon
            points={bandPoints}
            style={{
              fill: "color-mix(in srgb, var(--foreground) 10%, transparent)",
              stroke: "var(--border)",
              strokeWidth: 1,
            }}
          />
        </svg>

        {/* grips — thin vertical bars; the dragged one thickens and lifts */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 rounded-full transition-[height,width,box-shadow] duration-150 ease-out motion-reduce:transition-none"
          style={gripStyle(loPx, loEngaged)}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 rounded-full transition-[height,width,box-shadow] duration-150 ease-out motion-reduce:transition-none"
          style={gripStyle(hiPx, hiEngaged)}
        />
        {focusedThumb === "lo" && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 rounded-full ring-2 ring-ns-accent ring-offset-2 ring-offset-background"
            style={{
              transform: `translate3d(${loPx}px, ${TRACK_Y}px, 0) translate(-50%, -50%)`,
              height: 26,
              width: 3,
            }}
          />
        )}
        {focusedThumb === "hi" && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 rounded-full ring-2 ring-ns-accent ring-offset-2 ring-offset-background"
            style={{
              transform: `translate3d(${hiPx}px, ${TRACK_Y}px, 0) translate(-50%, -50%)`,
              height: 26,
              width: 3,
            }}
          />
        )}

        {/* real inputs carry all a11y: focusable, Tab-reachable, native
            arrow/Home/End/PageUp/PageDown; each one's own min/max is pinned to
            the other thumb's current value so keyboard can never cross them */}
        <input
          ref={minInputRef}
          type="range"
          min={min}
          max={hi}
          step={step}
          value={lo}
          aria-label={minLabel}
          aria-valuetext={`minimum, ${fmtRef.current(lo)} of maximum ${fmtRef.current(hi)}`}
          onChange={(e) => commit("lo", Math.min(quantize(Number(e.target.value)), hiRef.current))}
          onFocus={onFocusVisible("lo")}
          onBlur={onBlurThumb("lo")}
          className="sr-only"
        />
        <input
          ref={maxInputRef}
          type="range"
          min={lo}
          max={max}
          step={step}
          value={hi}
          aria-label={maxLabel}
          aria-valuetext={`maximum, ${fmtRef.current(hi)} of minimum ${fmtRef.current(lo)}`}
          onChange={(e) => commit("hi", Math.max(quantize(Number(e.target.value)), loRef.current))}
          onFocus={onFocusVisible("hi")}
          onBlur={onBlurThumb("hi")}
          className="sr-only"
        />
      </div>
    </div>
  );
}
