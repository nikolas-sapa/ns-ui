"use client";

// ---------------------------------------------------------------------------
// RingStain — a loader built on the coffee-ring effect. 90 small SVG
// particles drift outward from the center on a capillary-flow velocity
// profile (slow near the middle, sharply accelerating near the rim, the same
// shape as the outward flux that pins coffee grounds to a drying drop's
// contact line) plus a little Brownian jitter for organic texture. A
// particle that reaches the rim while its angle is "eligible" freezes there
// and brightens from --ns-muted to --foreground; an ineligible arrival just
// respawns near the center with a fresh angle. Nothing ever un-freezes and
// nothing rotates — nothing here is a cycle, the deposit is a residue.
//
// Two independent readings of "eligible":
//   determinate  (value 0-100)  -> a contiguous rim ARC, its width the
//                                   percent, so coverage angle reads as
//                                   progress.
//   indeterminate (value omitted) -> every angle is eligible, but the total
//                                   allowed to freeze is capped by an
//                                   asymptotic function of elapsed time, so
//                                   DENSITY alone encodes how long the wait
//                                   has run.
//
// On completion (value reaches 100, or the `complete` prop is set — the
// escape hatch for an indeterminate wait that resolves without ever having
// had a percent) the still-drifting interior particles fade out and the
// deposited rim particles ease, on a spring, onto sampled points along a
// checkmark path — the residue itself rearranges into the check, rather
// than being swapped for a separate glyph — while a thin stroke of the same
// path draws in underneath them for legibility when few particles deposited.
//
// prefers-reduced-motion drops the whole drift simulation: the same 90
// circles are pinned at fixed, evenly spaced rim slots from the first frame
// and never move again — only their opacity/fill step between "empty" and
// "deposited" at a coarse interval, in a fixed pseudo-random (golden-ratio)
// order so the reveal doesn't read as a mechanical wipe. Accumulation
// without motion.
//
// Pure DOM + SVG + CSS. Every stroke/fill is a `var(--token)` presentation
// attribute or a CSS class rule (CSS wins the cascade over the presentation
// attribute), so a theme flip needs no getComputedStyle and no rAF re-read.
// ---------------------------------------------------------------------------

import { useEffect, useId, useRef, useState } from "react";

export interface RingStainProps {
  /** progress 0-100. Omit for indeterminate (density-over-time). */
  value?: number;
  /** force the completion sequence even with no value (e.g. an
   * indeterminate wait that just resolved). Also true automatically once
   * `value` reaches 100. */
  complete?: boolean;
  /** glyph size in px (square). */
  size?: number;
  /** accessible name for the progressbar region. */
  label?: string;
  className?: string;
}

const COUNT = 90; // particles, within the 60-120 range
const RIM = 36; // rim radius, local units (the <g> is translated to center)
const CLIP_R = 44;
const SPAWN_R_MAX = 2.2;
const V_BASE = 5; // units/sec at r = 0
const V_RIM = 46; // units/sec approaching the rim (capillary acceleration)
const CAPILLARY_POWER = 2.6;
const JITTER_THETA = 0.9; // rad/sec-scale Brownian wobble
const JITTER_R = 3; // units/sec-scale Brownian wobble
const INDETERMINATE_TAU = 9; // seconds — density approaches full, never quite arrives
const ARC_START = -Math.PI / 2; // 12 o'clock
const TWO_PI = Math.PI * 2;
const STATUS_INTERVAL_MS = 1500; // aria-live text refresh cadence — coarse, not per-frame
const REDUCED_TICK_MS = 800; // reduced-motion stepwise fill cadence
const GOLDEN = 0.6180339887498949;
const CHECK_PATH = "M -18 2 L -6 15 L 20 -16";

interface Particle {
  r: number;
  theta: number;
  frozen: boolean;
  speedMul: number;
}

// deterministic per-index radius (0.5 - 1.5), a low-discrepancy sequence so
// dot sizes look organically varied without Math.random touching render.
// Floor on how many particles form the finished checkmark — see the completion
// effect. Enough to read as a dotted glyph rather than a few specks.
const MIN_RESIDUE = 34;
// Radii in local units against the 100-unit viewBox. Widened from 0.5..1.5:
// at the demo's 104-160px render that produced ~1.5-3px dots that all but
// vanished, and disappeared entirely on a scaled-down catalog card.
const RADII: number[] = Array.from({ length: COUNT }, (_, i) => 0.9 + ((i * GOLDEN + 0.5) % 1) * 1.6);

// deterministic fixed rim-slot angles for prefers-reduced-motion.
const SLOT_ANGLES: number[] = Array.from({ length: COUNT }, (_, i) => (i / COUNT) * TWO_PI);

// deterministic fill order for reduced-motion indeterminate density steps —
// a golden-ratio permutation so the reveal scatters rather than sweeps.
const FILL_ORDER: number[] = Array.from({ length: COUNT }, (_, i) => i).sort(
  (a, b) => ((a * GOLDEN) % 1) - ((b * GOLDEN) % 1),
);

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function densityCap(elapsedSec: number): number {
  return 1 - Math.exp(-elapsedSec / INDETERMINATE_TAU);
}

function withinArc(theta: number, fraction: number): boolean {
  const norm = (((theta - ARC_START) % TWO_PI) + TWO_PI) % TWO_PI;
  return norm < fraction * TWO_PI;
}

const CSS = `
.ns-rs-dot{transition:fill 220ms ease, opacity 220ms ease;}
.ns-rs-dot.ns-rs-deposit{fill:var(--foreground);}
.ns-rs-check{transition:stroke-dashoffset 420ms cubic-bezier(.34,1.56,.64,1) 90ms;}
@media (prefers-reduced-motion: reduce){
  .ns-rs-dot{transition:opacity 180ms ease;}
  .ns-rs-check{transition:none;}
}
`;

export function RingStain({
  value,
  complete,
  size = 120,
  label = "Loading",
  className = "",
}: RingStainProps) {
  const clipId = useId();
  const svgId = useId();

  const clampedValue = typeof value === "number" && !Number.isNaN(value) ? clamp01(value / 100) * 100 : undefined;
  const indeterminate = clampedValue === undefined;

  const [reducedMotion, setReducedMotion] = useState(false);
  const [settled, setSettled] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [resetCycle, setResetCycle] = useState(0);

  const elsRef = useRef<(SVGCircleElement | null)[]>([]);
  const checkPathRef = useRef<SVGPathElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const depositedRef = useRef<Set<number>>(new Set());
  const frozenCountRef = useRef(0);

  const valueRef = useRef(clampedValue);
  const settledRef = useRef(false);
  const reducedMotionRef = useRef(false);
  useEffect(() => {
    valueRef.current = clampedValue;
  }, [clampedValue]);
  useEffect(() => {
    settledRef.current = settled;
  }, [settled]);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  // watch the reduced-motion query, live.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // completion detection: value hitting 100, or the explicit `complete`
  // prop. Falling back out of completion (a reused loader starting a new
  // wait) bumps resetCycle so the particle field starts fresh.
  const prevSettledRef = useRef(false);
  useEffect(() => {
    const isComplete = complete === true || (clampedValue !== undefined && clampedValue >= 100);
    if (isComplete && !prevSettledRef.current) {
      prevSettledRef.current = true;
      setSettled(true);
    } else if (!isComplete && prevSettledRef.current) {
      prevSettledRef.current = false;
      setSettled(false);
      setResetCycle((k) => k + 1);
    }
  }, [complete, clampedValue]);

  // the particle simulation (or its reduced-motion stand-in). Restarts only
  // on mount, a reduced-motion flip, or an explicit new cycle — never on a
  // mere value tick, which would otherwise look like the ring restarting.
  useEffect(() => {
    const els = elsRef.current;
    const reduced = reducedMotionRef.current;

    const particles: Particle[] = Array.from({ length: COUNT }, (_, i) =>
      reduced
        ? { r: RIM, theta: SLOT_ANGLES[i], frozen: false, speedMul: 1 }
        : {
            r: Math.random() * SPAWN_R_MAX,
            theta: Math.random() * TWO_PI,
            frozen: false,
            speedMul: 0.75 + Math.random() * 0.6,
          },
    );
    particlesRef.current = particles;
    depositedRef.current = new Set();
    frozenCountRef.current = 0;

    for (let i = 0; i < COUNT; i++) {
      const el = els[i];
      if (!el) continue;
      el.classList.remove("ns-rs-deposit");
      el.style.transition = "none";
      el.style.opacity = "1";
      const p = particles[i];
      el.style.transform = `translate(${(p.r * Math.cos(p.theta)).toFixed(2)}px, ${(p.r * Math.sin(p.theta)).toFixed(2)}px)`;
    }
    const check = checkPathRef.current;
    if (check) {
      check.style.transition = "none";
      check.style.strokeDashoffset = "1";
    }
    // one reflow, then hand transform/transition back to normal control.
    void els[0]?.getBoundingClientRect();
    for (let i = 0; i < COUNT; i++) {
      const el = els[i];
      if (el) el.style.transition = "";
    }
    if (check) check.style.transition = "";

    const startedAt = performance.now();

    if (reduced) {
      const tick = () => {
        if (settledRef.current) return;
        const elapsed = (performance.now() - startedAt) / 1000;
        const v = valueRef.current;
        let filled: Set<number>;
        if (v !== undefined) {
          const frac = clamp01(v / 100);
          filled = new Set();
          for (let i = 0; i < COUNT; i++) {
            if (withinArc(particles[i].theta, frac)) filled.add(i);
          }
        } else {
          const cap = Math.round(densityCap(elapsed) * COUNT);
          filled = new Set(FILL_ORDER.slice(0, cap));
        }
        depositedRef.current = filled;
        frozenCountRef.current = filled.size;
        for (let i = 0; i < COUNT; i++) {
          const el = els[i];
          if (el) el.classList.toggle("ns-rs-deposit", filled.has(i));
        }
      };
      tick();
      const id = window.setInterval(tick, REDUCED_TICK_MS);
      return () => window.clearInterval(id);
    }

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      if (settledRef.current) {
        raf = 0;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const elapsed = (now - startedAt) / 1000;
      const v = valueRef.current;
      const frac = v !== undefined ? clamp01(v / 100) : 0;

      for (let i = 0; i < COUNT; i++) {
        const p = particles[i];
        const el = els[i];
        if (p.frozen || !el) continue;

        const speed = V_BASE + (V_RIM - V_BASE) * Math.pow(Math.min(1, p.r / RIM), CAPILLARY_POWER);
        p.r += speed * p.speedMul * dt;
        p.theta += (Math.random() - 0.5) * JITTER_THETA * dt;
        p.r += (Math.random() - 0.5) * JITTER_R * dt;
        if (p.r < 0) p.r = 0;

        if (p.r >= RIM) {
          const eligible = v !== undefined ? withinArc(p.theta, frac) : frozenCountRef.current < densityCap(elapsed) * COUNT;
          if (eligible) {
            p.frozen = true;
            p.r = RIM;
            frozenCountRef.current += 1;
            depositedRef.current.add(i);
            el.style.transform = `translate(${(RIM * Math.cos(p.theta)).toFixed(2)}px, ${(RIM * Math.sin(p.theta)).toFixed(2)}px)`;
            el.classList.add("ns-rs-deposit");
            continue;
          }
          p.r = Math.random() * SPAWN_R_MAX;
          p.theta = Math.random() * TWO_PI;
          p.speedMul = 0.75 + Math.random() * 0.6;
        }
        el.style.transform = `translate(${(p.r * Math.cos(p.theta)).toFixed(2)}px, ${(p.r * Math.sin(p.theta)).toFixed(2)}px)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [resetCycle, reducedMotion]);

  // completion: fade the interior, ease every deposited particle onto a
  // sampled point along the checkmark path, draw the underlying stroke.
  useEffect(() => {
    if (!settled) return;
    const els = elsRef.current;
    const check = checkPathRef.current;
    const deposited = Array.from(depositedRef.current);
    const total = check ? check.getTotalLength() : 0;
    const reduced = reducedMotionRef.current;

    // The residue IS the checkmark, so there has to be some. Completing with an
    // empty deposit set used to hide all COUNT particles and leave a bare
    // stroke: mounting already-complete (or firing `complete` during an early
    // indeterminate wait) never gives the rim time to collect anything, so the
    // panel rendered as an empty circle — measured deposited:0, 90 particles at
    // opacity:0. Recruit particles up to a floor so the glyph always reads as
    // settled residue, and mark the recruits deposited so they take the same
    // --foreground fill rather than staying muted.
    const residue = deposited.slice();
    for (let i = 0; i < COUNT && residue.length < MIN_RESIDUE; i++) {
      if (depositedRef.current.has(i)) continue;
      depositedRef.current.add(i);
      els[i]?.classList.add("ns-rs-deposit");
      residue.push(i);
    }

    residue.forEach((idx, j) => {
      const el = els[idx];
      if (!el || !check) return;
      const frac = residue.length > 1 ? j / (residue.length - 1) : 0.5;
      const pt = check.getPointAtLength(frac * total);
      el.style.transition = reduced ? "none" : "transform 460ms cubic-bezier(.34,1.56,.64,1)";
      el.style.transform = `translate(${pt.x.toFixed(2)}px, ${pt.y.toFixed(2)}px)`;
    });

    const onCheck = new Set(residue);
    for (let i = 0; i < COUNT; i++) {
      if (onCheck.has(i)) continue;
      const el = els[i];
      if (!el) continue;
      el.style.transition = reduced ? "none" : "opacity 200ms ease";
      el.style.opacity = "0";
    }

    if (check) check.style.strokeDashoffset = "0";
  }, [settled]);

  // visually hidden status line, refreshed at a coarse interval — never
  // per-frame.
  useEffect(() => {
    const compute = () => {
      if (settled) return `${label} complete.`;
      if (clampedValue !== undefined) return `${label}, ${Math.round(clampedValue)} percent.`;
      const pct = Math.round((depositedRef.current.size / COUNT) * 100);
      return `${label}, ring ${pct} percent filled.`;
    };
    setStatusText(compute());
    if (settled) return;
    const id = window.setInterval(() => setStatusText(compute()), STATUS_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [clampedValue, label, settled]);

  const displayPct = indeterminate ? undefined : settled ? 100 : Math.round(clampedValue as number);

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`} data-ring-stain>
      <style>{CSS}</style>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : displayPct}
        aria-busy={indeterminate && !settled}
        style={{ width: size, height: size }}
        className="relative shrink-0"
      >
        <svg
          id={svgId}
          viewBox="0 0 100 100"
          width={size}
          height={size}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            {/*
              userSpaceOnUse (the default) resolves this circle in the user
              space of the element that REFERENCES the clip — i.e. the <g>
              below, AFTER its own translate(50 50). Authoring it at (50,50)
              therefore put the clip at viewBox (100,100) and clipped every
              particle and the checkmark away, leaving a bare crescent of the
              rim. The clip is centred on the same origin as its contents: 0,0.
            */}
            <clipPath id={clipId}>
              <circle cx={0} cy={0} r={CLIP_R} />
            </clipPath>
          </defs>
          <g transform="translate(50 50)" clipPath={`url(#${clipId})`}>
            <circle r={RIM} fill="none" stroke="var(--border)" strokeWidth={1.4} />
            {Array.from({ length: COUNT }).map((_, i) => (
              <circle
                key={i}
                ref={(el) => {
                  elsRef.current[i] = el;
                }}
                className="ns-rs-dot"
                r={RADII[i]}
                cx={0}
                cy={0}
                fill="var(--ns-muted)"
              />
            ))}
            <path
              ref={checkPathRef}
              className="ns-rs-check"
              d={CHECK_PATH}
              pathLength={1}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="1 1"
              style={{ strokeDashoffset: 1 }}
            />
          </g>
        </svg>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {statusText}
      </span>
    </div>
  );
}
