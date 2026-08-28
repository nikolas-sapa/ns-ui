"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// EquationKidneyCam — a section divider whose midpoint tick rides the real
// equation-of-time curve instead of sitting still. In an "equation
// marchante" watch (Breguet, Blancpain), a kidney-profiled cam turns once
// per year and a spring-loaded follower reads its edge, converting the
// cam's UNIFORM rotation into the NON-uniform, sign-changing swing between
// mean solar time and apparent solar time (-14m15s mid-February to
// +16m23s early November, crossing zero four times a year).
//
// The cam profile itself is never generated live. MONTH_EOT below holds 12
// real, almanac-sourced equation-of-time values (minutes) at 1-of-month
// intervals; wrapping December back into January makes a 13th, closing
// point. A periodic Catmull-Rom spline through those 12 anchors (each
// evaluated with its wrapped neighbours) is resampled at 5 points per
// segment — 60 points total, EOT_LUT — once, at module load. That table IS
// the cam: index i is the follower's radial reading at the angle the disc
// would be at i/60 of a full turn. Per rAF frame the only work done is
// picking two adjacent LUT entries by the current phase and lerping
// between them — no trig, no live curve evaluation.
//
// Real annual period: 1 year. Rendered period: 11s, documented here as a
// ~2.87-million-times compression (365.25 days / 11s) purely for card
// legibility — not a simulated calendar, just the same closed curve run
// fast. The follower's on-screen offset is the LUT value scaled by the
// LARGER of the curve's two real extremes (|+16.23| minutes), so the
// positive swing reaches the full +-22% of the divider's half-length while
// the (smaller-magnitude) negative swing falls proportionally short of
// it — the asymmetry is inherited from the real numbers, never forced.
// Because the underlying anchors are unevenly spaced in "when it crosses
// zero", the resulting sweep is not a sine: the drop from most-negative to
// zero is visibly quicker than the climb from zero to most-positive, and
// the four zero-crossing brighten-pulses per 11s cycle land at uneven
// intervals — the detail that reads as "cam", not "wave".
//
// Colour: the rule line sits at a mid-strength mix of --foreground (35%)
// so it's visible without being a full-strength rule (a --border stroke,
// at light theme's ~1.1:1 contrast, would make the follower's motion
// unreadable — the whole point of this component). Each zero-crossing
// briefly lifts that same --foreground opacity by 8% for 400ms via a
// restarted CSS animation — never --ns-accent, which is reserved for
// interaction chrome and never appears here since this is a passive
// divider with no interaction. An optional low-opacity ghost of the cam's
// own kidney outline (rendered from the identical LUT, as a closed SVG
// path) fades in on hover/focus purely as a decorative aid — position:
// absolute, so it can never affect layout.
// ---------------------------------------------------------------------------

export interface EquationKidneyCamProps {
  className?: string;
}

// -- Real, almanac-sourced equation-of-time values (minutes), 1st-of-month,
// Jan through Dec. Standard published approximation; the true extremes
// (-14m15s mid-Feb, +16m23s early Nov) fall between these monthly anchors
// and are recovered by the spline, not hardcoded. --------------------------
const MONTH_EOT = [-3.4, -13.6, -12.6, -4.1, 2.9, 2.4, -3.6, -6.3, -0.1, 10.1, 16.4, 11.2];
const ANCHOR_COUNT = MONTH_EOT.length;
const SAMPLES_PER_SEGMENT = 5;
const LUT_SIZE = ANCHOR_COUNT * SAMPLES_PER_SEGMENT; // 60

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function buildLut(): number[] {
  const lut: number[] = [];
  for (let seg = 0; seg < ANCHOR_COUNT; seg++) {
    const p0 = MONTH_EOT[(seg - 1 + ANCHOR_COUNT) % ANCHOR_COUNT];
    const p1 = MONTH_EOT[seg];
    const p2 = MONTH_EOT[(seg + 1) % ANCHOR_COUNT];
    const p3 = MONTH_EOT[(seg + 2) % ANCHOR_COUNT];
    for (let s = 0; s < SAMPLES_PER_SEGMENT; s++) {
      const t = s / SAMPLES_PER_SEGMENT;
      lut.push(catmullRom(p0, p1, p2, p3, t));
    }
  }
  return lut;
}

const EOT_LUT = buildLut();
const LUT_MAX_ABS = EOT_LUT.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
let MIN_INDEX = 0;
let minVal = Infinity;
for (let i = 0; i < EOT_LUT.length; i++) {
  const v = EOT_LUT[i];
  if (v < minVal) {
    minVal = v;
    MIN_INDEX = i;
  }
}

// -- ghost cam outline, built once from the same LUT: a closed polar path
// (angle = i/60 of a turn, radius = base + LUT value * scale). Decorative
// only; never rendered visibly at rest, only revealed faintly on hover. --
const GHOST_VB = 64;
const GHOST_CX = GHOST_VB / 2;
const GHOST_CY = GHOST_VB / 2;
const GHOST_BASE_R = 14;
const GHOST_R_SCALE = 8 / LUT_MAX_ABS;
const GHOST_PATH = (() => {
  let d = "";
  for (let i = 0; i < LUT_SIZE; i++) {
    const angle = (i / LUT_SIZE) * Math.PI * 2 - Math.PI / 2;
    const r = GHOST_BASE_R + EOT_LUT[i] * GHOST_R_SCALE;
    const x = GHOST_CX + Math.cos(angle) * r;
    const y = GHOST_CY + Math.sin(angle) * r;
    d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d} Z`;
})();

const CAM_PERIOD_MS = 11000; // real period: 1 year — an ~2.87M:1 compression
const MAX_OFFSET_PCT = 22; // +-22% of the divider's half-length
const PULSE_MS = 400;
const HEIGHT_PX = 28; // fixed card-scale height; every other dimension below derives from it
const TICK_HEIGHT_PX = Math.round(HEIGHT_PX * 0.5);

export function EquationKidneyCam({ className = "" }: EquationKidneyCamProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const line = lineRef.current;
    const tick = tickRef.current;
    if (!root || !line || !tick) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const sampleAt = (idxFloat: number): number => {
      const i0 = Math.floor(idxFloat) % LUT_SIZE;
      const i1 = (i0 + 1) % LUT_SIZE;
      const frac = idxFloat - Math.floor(idxFloat);
      return EOT_LUT[i0] + (EOT_LUT[i1] - EOT_LUT[i0]) * frac;
    };

    const applyOffset = (value: number) => {
      const pct = (value / LUT_MAX_ABS) * MAX_OFFSET_PCT;
      tick.style.left = `${50 + pct}%`;
    };

    const firePulse = () => {
      line.style.animation = "none";
      // force reflow so re-setting the animation below restarts it
      void line.offsetWidth;
      line.style.animation = `ns-eqcam-pulse ${PULSE_MS}ms ease-out`;
    };

    if (reduced) {
      // freeze on the real-world most-negative point (mid-February
      // analogue, -14m15s) — the cam's tightest inward point and the most
      // visually distinct resting position, per the reduced-motion rule.
      applyOffset(EOT_LUT[MIN_INDEX]);
      return;
    }

    let raf = 0;
    let visible = true;
    let startTime = 0;
    let prevSign = Math.sign(EOT_LUT[0]) || 1;

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      if (startTime === 0) startTime = now;
      const elapsed = now - startTime;
      const phase = (elapsed % CAM_PERIOD_MS) / CAM_PERIOD_MS;
      const idxFloat = phase * LUT_SIZE;
      const value = sampleAt(idxFloat);
      applyOffset(value);

      const sign = value === 0 ? prevSign : Math.sign(value);
      if (sign !== prevSign) firePulse();
      prevSign = sign;

      raf = requestAnimationFrame(loop);
    };

    // -- no paint before the first token/geometry read: only start once
    // the divider is actually on screen, and pause the rAF loop (not the
    // logical clock — startTime is wall-clock, so re-entering resumes the
    // correct phase, not a reset) while it scrolls off. -------------------
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    });
    io.observe(root);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      role="separator"
      aria-orientation="horizontal"
      data-eqcam
      className={`ns-eqcam relative w-full ${className}`}
      style={{ height: HEIGHT_PX }}
    >
      <style>{`
.ns-eqcam{ display:flex; align-items:center; }
.ns-eqcam-line{
  position:relative;
  width:100%;
  height:1px;
  background:var(--foreground);
  opacity:0.35;
}
.ns-eqcam-tick{
  position:absolute;
  top:50%;
  width:1px;
  height:${TICK_HEIGHT_PX}px;
  background:var(--foreground);
  opacity:0.9;
  transform:translate(-50%, -50%);
  left:50%;
}
.ns-eqcam-ghost{
  position:absolute;
  left:50%;
  top:50%;
  width:${GHOST_VB}px;
  height:${GHOST_VB}px;
  transform:translate(-50%, -50%);
  opacity:0;
  pointer-events:none;
  transition:opacity 300ms ease;
}
.ns-eqcam:hover .ns-eqcam-ghost{ opacity:0.18; }
@keyframes ns-eqcam-pulse{
  0%{ opacity:0.43; }
  100%{ opacity:0.35; }
}
@media (prefers-reduced-motion: reduce){
  .ns-eqcam-line{ animation:none!important; }
  .ns-eqcam-ghost{ transition:none!important; }
}
`}</style>
      <div ref={lineRef} className="ns-eqcam-line" aria-hidden="true" />
      <div ref={tickRef} className="ns-eqcam-tick" aria-hidden="true" />
      <svg
        className="ns-eqcam-ghost"
        viewBox={`0 0 ${GHOST_VB} ${GHOST_VB}`}
        aria-hidden="true"
        focusable="false"
      >
        <path d={GHOST_PATH} fill="none" stroke="var(--foreground)" strokeWidth={1} />
      </svg>
    </div>
  );
}
