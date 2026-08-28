"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// TonearmSkate — a read-only tracking-quality gauge built from the actual
// geometry of a pivoted phono tonearm, not an invented needle sweep. A 9"
// arm pivoted 215mm from the spindle (LP_MM) with a 225mm effective
// (pivot-to-stylus) length traces an arc whose distance from the spindle is
// r(alpha) = sqrt(Lp^2 + l^2 + 2*Lp*l*cos(alpha)) — the same law-of-cosines
// relationship that puts a real two-null Baerwald alignment's zero-error
// points at 66mm and 120mm for this pivot distance. The arm sweeps that
// radius from a 146mm lead-in down to a 60mm run-out over 48s, then lifts
// and swings back to the lead-in to start the next "side" — unbounded, no
// dead stop. A separate small tracking-error strip reads a continuously
// computed geometric value: 0 exactly at the two null radii, growing to
// roughly +/-2 degrees at the two grooved edges, with a documented (not
// simulated) interior lobe between the nulls so the needle visibly departs
// center and returns rather than sitting dead flat for 63% of the sweep.
// The needle itself never gains weight/opacity from --ns-accent — only
// stroke-width and opacity scale with |error|, foreground throughout.
//
// Disc spins independently of the arm at 1 rev / 4s, continuously, even
// while the arm is lifted between sides, matching a real motor that never
// stops. Everything is a single rAF loop mutating refs directly (no
// per-frame setState) driven off the frame timestamp so a backgrounded tab
// can't drift the arm out of sync with the disc. Pure SVG + Tailwind token
// classes (text-foreground / text-border / text-ns-muted) — no raster
// surface, so no getComputedStyle/MutationObserver token machinery is
// needed; both themes restyle for free via currentColor.
// ---------------------------------------------------------------------------

// --- real geometry, millimetres -------------------------------------------
const LP_MM = 215; // pivot-to-spindle distance, standard 9" arm
const L_EFF_MM = 225; // effective (pivot-to-stylus) arm length
const R_OUTER_MM = 146; // lead-in groove radius
const R_INNER_MM = 60; // run-out groove radius
const NULL_OUTER_MM = 120; // outer Baerwald null
const NULL_INNER_MM = 66; // inner Baerwald null
const NULL_MID_MM = (NULL_OUTER_MM + NULL_INNER_MM) / 2; // 93mm, interior lobe

// error-angle keyframes (radius mm, error deg), outer -> inner. Anchored to
// the real null radii (0 at each) and the documented +/-2deg edge magnitudes;
// the interior lobe at NULL_MID_MM is set to ~35% of the edge magnitude,
// matching a real Baerwald curve's interior maximum, so the needle visibly
// leaves center and returns rather than reading as a flat line between the
// two nulls (63% of the sweep would otherwise show zero motion).
const ERROR_KEYFRAMES: [r: number, deg: number][] = [
  [R_OUTER_MM, 2.0],
  [NULL_OUTER_MM, 0],
  [NULL_MID_MM, -0.7],
  [NULL_INNER_MM, 0],
  [R_INNER_MM, -2.0],
];
const SKATE_LEAN_DEG = 3; // constant inward headshell cant, present throughout

// --- timing -----------------------------------------------------------------
const DISC_PERIOD_MS = 4_000; // 1 rev / 4s, documented decoupling from 33 1/3 RPM
const SWEEP_MS = 48_000; // outer lead-in to inner run-out
const HOLD_MS = 700; // brief rest at run-out before lift
const LIFT_MS = 1_400; // lift + swing back + set down
const SETTLE_MS = 300; // brief rest at lead-in before the next side
const CYCLE_MS = SWEEP_MS + HOLD_MS + LIFT_MS + SETTLE_MS;
const LIFT_PEAK_VB = 10; // vb units the arm rises at the peak of the lift

// --- scene geometry, viewBox units (vb) -------------------------------------
const VB = 300;
const RECORD_R_VB = 96;
const SCALE = RECORD_R_VB / 150; // mm -> vb, record outer radius is 150mm
const SP = { x: 108, y: 150 }; // spindle
const LP_VB = LP_MM * SCALE;
const L_EFF_VB = L_EFF_MM * SCALE;
const PV = { x: SP.x + LP_VB, y: SP.y }; // pivot, off-platter to the right
const CW_LEN_VB = 34; // counterweight distance behind the pivot
const THREAD_ANCHOR = { x: PV.x - 12, y: PV.y - 14 }; // anti-skate post

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}
function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function smoothstep(t: number) {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// arm rotation angle (deg, absolute, measured from the pivot's +x axis with
// the spindle at angle 180 from it) that puts the stylus at radius r_mm.
// Derived from r^2 = Lp^2 + l^2 + 2*Lp*l*cos(alpha) — real law-of-cosines
// geometry, not a fit.
function alphaForRadius(rMm: number) {
  const r = clamp(rMm, R_INNER_MM, R_OUTER_MM);
  const cosA = (r * r - LP_MM * LP_MM - L_EFF_MM * L_EFF_MM) / (2 * LP_MM * L_EFF_MM);
  return toDeg(Math.acos(clamp(cosA, -1, 1)));
}

// smooth interpolation through ERROR_KEYFRAMES, zero-derivative at each
// keyframe so a null crossing visibly settles rather than snapping through.
function errorForRadius(rMm: number) {
  const r = clamp(rMm, R_INNER_MM, R_OUTER_MM);
  for (let i = 0; i < ERROR_KEYFRAMES.length - 1; i++) {
    const [r0, e0] = ERROR_KEYFRAMES[i];
    const [r1, e1] = ERROR_KEYFRAMES[i + 1];
    if (r <= r0 && r >= r1) {
      const t = (r0 - r) / (r0 - r1);
      return lerp(e0, e1, smoothstep(t));
    }
  }
  return ERROR_KEYFRAMES[ERROR_KEYFRAMES.length - 1][1];
}

// stylus position in vb units for a given absolute arm angle (deg).
function stylusPoint(alphaDeg: number) {
  const a = toRad(alphaDeg);
  return {
    x: PV.x + L_EFF_VB * Math.cos(a),
    y: PV.y + L_EFF_VB * Math.sin(a),
  };
}

// every derived point painted each frame, for a given virtual radius and
// lift offset — shared by the rAF loop and the static t0 JSX below it, so
// the two can never drift apart.
function geometryFor(rMm: number, lift: number) {
  const alpha = alphaForRadius(rMm);
  const stylus = stylusPoint(alpha);
  const cwAngle = toRad(alpha + 180);
  const cw = {
    x: PV.x + CW_LEN_VB * Math.cos(cwAngle),
    y: PV.y + CW_LEN_VB * Math.sin(cwAngle),
  };
  const threadEnd = {
    x: PV.x + (stylus.x - PV.x) * 0.72,
    y: PV.y + (stylus.y - PV.y) * 0.72 - lift,
  };
  const tubeExt = {
    x: stylus.x + 16 * Math.cos(toRad(alpha)),
    y: stylus.y + 16 * Math.sin(toRad(alpha)),
  };
  const headshellRot = alpha + 180 + SKATE_LEAN_DEG;
  const err = errorForRadius(rMm);
  const needleX = 130 + (err / 2) * 110;
  return { alpha, stylus, cw, threadEnd, tubeExt, headshellRot, err, needleX };
}

// static t0 geometry (arm at the lead-in, no lift) — rendered inline in JSX
// so the SVG never commits a degenerate (0,0) frame before the first rAF
// tick, including in the server-rendered / pre-hydration HTML.
const T0 = geometryFor(R_OUTER_MM, 0);

// the arm's virtual radius (mm) and lift offset (vb) at elapsed time within
// one full cycle (sweep, hold, lift-and-return, settle). `airborne` marks
// the lift phase, where the stylus is off the groove and the tracking-error
// readout is not a real reading.
function stateForCycleT(cycleMs: number) {
  if (cycleMs < SWEEP_MS) {
    return {
      rMm: lerp(R_OUTER_MM, R_INNER_MM, cycleMs / SWEEP_MS),
      lift: 0,
      opacity: 1,
      airborne: false,
    };
  }
  if (cycleMs < SWEEP_MS + HOLD_MS) {
    return { rMm: R_INNER_MM, lift: 0, opacity: 1, airborne: false };
  }
  if (cycleMs < SWEEP_MS + HOLD_MS + LIFT_MS) {
    const p = (cycleMs - SWEEP_MS - HOLD_MS) / LIFT_MS;
    const pe = easeInOutCubic(p);
    const hump = Math.sin(Math.PI * p);
    return {
      rMm: lerp(R_INNER_MM, R_OUTER_MM, pe),
      lift: LIFT_PEAK_VB * hump,
      opacity: 1 - 0.12 * hump,
      airborne: true,
    };
  }
  return { rMm: R_OUTER_MM, lift: 0, opacity: 1, airborne: false };
}

// the frozen prefers-reduced-motion frame: arm pinned exactly at the first
// (inner) null, 66mm — needle centered, while a non-zero disc angle shows
// the disc has visibly turned, so the arm's non-radial rest is legible by
// contrast rather than looking like a static clock illustration.
const REDUCED_R_MM = NULL_INNER_MM;
const REDUCED_DISC_DEG = 135;

function fmtDeg(n: number) {
  if (Math.abs(n) < 0.05) return "0.0°"; // unsigned at the null, no +/- flicker
  const s = n > 0 ? "+" : "−";
  return `${s}${Math.abs(n).toFixed(1)}°`;
}

export interface TonearmSkateProps {
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function TonearmSkate({ className = "" }: TonearmSkateProps) {
  const discRef = useRef<SVGGElement>(null);
  const armLineRef = useRef<SVGLineElement>(null);
  const armGroupRef = useRef<SVGGElement>(null);
  const tubeExtRef = useRef<SVGLineElement>(null);
  const headshellRef = useRef<SVGRectElement>(null);
  const stylusDotRef = useRef<SVGCircleElement>(null);
  const cwRef = useRef<SVGCircleElement>(null);
  const threadRef = useRef<SVGLineElement>(null);
  const needleRef = useRef<SVGLineElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    let raf = 0;
    let startTs: number | null = null;
    const onReducedChange = () => {
      reduced = mq.matches;
      // the loop stops rescheduling itself while reduced (one static paint
      // is enough); re-arm it here if motion is turned back on.
      if (!reduced && raf === 0) {
        startTs = null;
        raf = requestAnimationFrame(frame);
      }
    };
    mq.addEventListener("change", onReducedChange);

    function paint(
      rMm: number,
      discDeg: number,
      lift: number,
      armOpacity: number,
      airborne: boolean
    ) {
      const { stylus, cw, threadEnd, tubeExt, headshellRot, err, needleX } = geometryFor(
        rMm,
        lift
      );

      if (discRef.current) {
        discRef.current.setAttribute("transform", `rotate(${discDeg} ${SP.x} ${SP.y})`);
      }
      if (armGroupRef.current) {
        armGroupRef.current.setAttribute("transform", `translate(0 ${-lift})`);
        armGroupRef.current.setAttribute("opacity", String(armOpacity));
      }
      if (armLineRef.current) {
        armLineRef.current.setAttribute("x1", String(PV.x));
        armLineRef.current.setAttribute("y1", String(PV.y));
        armLineRef.current.setAttribute("x2", String(stylus.x));
        armLineRef.current.setAttribute("y2", String(stylus.y));
      }
      if (tubeExtRef.current) {
        tubeExtRef.current.setAttribute("x1", String(stylus.x));
        tubeExtRef.current.setAttribute("y1", String(stylus.y));
        tubeExtRef.current.setAttribute("x2", String(tubeExt.x));
        tubeExtRef.current.setAttribute("y2", String(tubeExt.y));
      }
      if (headshellRef.current) {
        headshellRef.current.setAttribute(
          "transform",
          `translate(${stylus.x} ${stylus.y}) rotate(${headshellRot})`
        );
      }
      if (stylusDotRef.current) {
        stylusDotRef.current.setAttribute("cx", String(stylus.x));
        stylusDotRef.current.setAttribute("cy", String(stylus.y));
      }
      if (cwRef.current) {
        cwRef.current.setAttribute("cx", String(cw.x));
        cwRef.current.setAttribute("cy", String(cw.y));
      }
      if (threadRef.current) {
        threadRef.current.setAttribute("x1", String(THREAD_ANCHOR.x));
        threadRef.current.setAttribute("y1", String(THREAD_ANCHOR.y));
        threadRef.current.setAttribute("x2", String(threadEnd.x));
        threadRef.current.setAttribute("y2", String(threadEnd.y));
      }

      // needle strip: error in [-2, 2] deg maps to x in [20, 240], weight
      // (stroke-width + opacity) scales with |error| / 2 — never accent.
      // While airborne (lifted between sides) the reading isn't real, so it
      // fades to near-invisible instead of whipping across the strip.
      const weight = clamp(Math.abs(err) / 2, 0, 1);
      if (needleRef.current) {
        needleRef.current.setAttribute("x1", String(needleX));
        needleRef.current.setAttribute("x2", String(needleX));
        needleRef.current.setAttribute("stroke-width", String(1.5 + weight * 1.6));
        needleRef.current.setAttribute("opacity", String(airborne ? 0.2 : 0.55 + weight * 0.45));
      }
      if (readoutRef.current) {
        readoutRef.current.textContent = airborne ? "—" : fmtDeg(err);
      }
    }

    function frame(ts: number) {
      if (reduced) {
        paint(REDUCED_R_MM, REDUCED_DISC_DEG, 0, 1, false);
        raf = 0; // repaint on demand only; the change listener re-arms this
        return;
      }
      if (startTs === null) startTs = ts;
      const elapsed = ts - startTs;
      const discDeg = ((elapsed % DISC_PERIOD_MS) / DISC_PERIOD_MS) * 360;
      const cycleT = elapsed % CYCLE_MS;
      const { rMm, lift, opacity, airborne } = stateForCycleT(cycleT);
      paint(rMm, discDeg, lift, opacity, airborne);
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", onReducedChange);
    };
  }, []);

  return (
    <div
      className={`w-full max-w-sm rounded-md border border-border bg-surface p-4 ${className}`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] tracking-widest text-ns-muted">TONEARM</p>
        <p className="font-mono text-[10px] tracking-widest text-ns-muted">
          NULLS {NULL_INNER_MM} / {NULL_OUTER_MM}MM
        </p>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[280px]">
        <svg viewBox={`0 0 ${VB} ${VB}`} className="h-full w-full" aria-hidden focusable="false">
          {/* disc: outer edge, groove-ring ticks, paper label, one foreground
              notch that is the sole visible proof of rotation */}
          <g ref={discRef}>
            <circle
              cx={SP.x}
              cy={SP.y}
              r={RECORD_R_VB}
              fill="none"
              className="stroke-current text-foreground"
              strokeWidth={1.25}
            />
            <circle
              cx={SP.x}
              cy={SP.y}
              r={R_OUTER_MM * SCALE}
              fill="none"
              className="stroke-current text-border"
              strokeWidth={0.75}
            />
            {/* the two null rings are load-bearing — they're what lets a
                viewer see the stylus reach a null the instant the needle
                centers, so they get foreground weight, not border */}
            <circle
              cx={SP.x}
              cy={SP.y}
              r={NULL_OUTER_MM * SCALE}
              fill="none"
              className="stroke-current text-foreground"
              strokeWidth={0.85}
              opacity={0.35}
            />
            <circle
              cx={SP.x}
              cy={SP.y}
              r={NULL_INNER_MM * SCALE}
              fill="none"
              className="stroke-current text-foreground"
              strokeWidth={0.85}
              opacity={0.35}
            />
            <circle
              cx={SP.x}
              cy={SP.y}
              r={R_INNER_MM * SCALE}
              fill="none"
              className="stroke-current text-border"
              strokeWidth={0.75}
            />
            {/* paper label */}
            <circle
              cx={SP.x}
              cy={SP.y}
              r={20}
              className="fill-current text-ns-muted"
              opacity={0.16}
            />
            {/* rotation notch — the one asymmetric mark, foreground so it
                stays visible in light theme */}
            <line
              x1={SP.x}
              y1={SP.y - 20}
              x2={SP.x}
              y2={SP.y - 27}
              className="stroke-current text-foreground"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            {/* spindle */}
            <circle cx={SP.x} cy={SP.y} r={2.5} className="fill-current text-foreground" />
          </g>

          {/* anti-skate post + thread live outside the lifted group — only
              the thread's far end (attached to the arm) rises with it, so
              the post it's anchored to never appears to detach */}
          <circle
            cx={THREAD_ANCHOR.x}
            cy={THREAD_ANCHOR.y}
            r={2.5}
            className="fill-current text-foreground"
            opacity={0.5}
          />
          <line
            ref={threadRef}
            x1={THREAD_ANCHOR.x}
            y1={THREAD_ANCHOR.y}
            x2={T0.threadEnd.x}
            y2={T0.threadEnd.y}
            className="stroke-current text-foreground"
            strokeWidth={0.75}
            strokeDasharray="2 2"
            opacity={0.45}
          />
          {/* pivot mount, also fixed, never lifts */}
          <circle
            cx={PV.x}
            cy={PV.y}
            r={6}
            fill="none"
            className="stroke-current text-border"
            strokeWidth={1.25}
          />

          <g ref={armGroupRef}>
            {/* counterweight */}
            <circle
              ref={cwRef}
              cx={T0.cw.x}
              cy={T0.cw.y}
              r={7}
              className="fill-current text-foreground"
              opacity={0.85}
            />
            {/* arm tube */}
            <line
              ref={armLineRef}
              x1={PV.x}
              y1={PV.y}
              x2={T0.stylus.x}
              y2={T0.stylus.y}
              className="stroke-current text-foreground"
              strokeWidth={2.25}
              strokeLinecap="round"
            />
            {/* tube-axis extension, uncanted — diverges visibly from the
                headshell body below to make the constant 3deg skate lean
                legible (a single rotated rect alone reads at well under a
                pixel of displacement) */}
            <line
              ref={tubeExtRef}
              x1={T0.stylus.x}
              y1={T0.stylus.y}
              x2={T0.tubeExt.x}
              y2={T0.tubeExt.y}
              className="stroke-current text-foreground"
              strokeWidth={0.75}
              opacity={0.3}
            />
            {/* headshell, canted by the constant skate lean */}
            <rect
              ref={headshellRef}
              x={-4}
              y={-7}
              width={22}
              height={6}
              rx={1.25}
              transform={`translate(${T0.stylus.x} ${T0.stylus.y}) rotate(${T0.headshellRot})`}
              className="fill-current text-foreground"
            />
            {/* stylus / contact point */}
            <circle
              ref={stylusDotRef}
              cx={T0.stylus.x}
              cy={T0.stylus.y}
              r={1.75}
              className="fill-current text-foreground"
            />
          </g>
        </svg>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <p className="font-mono text-[11px] tracking-widest text-ns-muted">TRACKING ERROR</p>
        <span
          ref={readoutRef}
          className="font-mono text-[11px] font-semibold tabular-nums text-foreground"
        >
          {fmtDeg(T0.err)}
        </span>
      </div>

      <svg viewBox="0 0 260 24" className="mt-1 h-6 w-full" aria-hidden focusable="false">
        <line x1={20} x2={240} y1={12} y2={12} className="stroke-current text-border" strokeWidth={1} />
        <line x1={20} x2={20} y1={7} y2={17} className="stroke-current text-border" strokeWidth={1} />
        <line x1={240} x2={240} y1={7} y2={17} className="stroke-current text-border" strokeWidth={1} />
        <line x1={130} x2={130} y1={5} y2={19} className="stroke-current text-foreground" strokeWidth={1} opacity={0.4} />
        <line
          ref={needleRef}
          x1={T0.needleX}
          x2={T0.needleX}
          y1={4}
          y2={20}
          strokeWidth={1.5 + clamp(Math.abs(T0.err) / 2, 0, 1) * 1.6}
          className="stroke-current text-foreground"
          strokeLinecap="round"
        />
      </svg>

      <p className="mt-2 font-mono text-[10px] leading-relaxed text-ns-muted">
        lead-in {R_OUTER_MM}mm &middot; run-out {R_INNER_MM}mm &mdash; error crosses zero at each
        null, growing toward both edges
      </p>
    </div>
  );
}
