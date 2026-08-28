"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// RemontoireRewind — a sync/upload progress strip driven by a constant-force
// remontoire instead of a plain glide. In a real remontoire d'egalite (e.g.
// Harrison's regulators) a small secondary spring is slowly wound by the
// mainspring, then trips and dumps ONE calibrated, constant-force release
// into the escapement, over and over — the escapement only ever feels the
// remontoire's flat repeated kick, never the mainspring's decaying torque.
// Here the spring glyph (an SVG coil, drawn fresh each frame as a sampled
// sine path so its pitch reads continuously, not as a swapped sprite) winds
// tighter — 5 visible turns compressing to 2 — over a slow "wind" phase,
// then snaps back out to 5 with one small overshoot on "trip". The bar
// underneath mirrors the same two-speed rhythm: a near-invisible 0.3%/s
// creep through the wind, then a fixed 6% kick — ~20x the creep rate — in
// the same instant the spring releases, so trip reads as a distinct payoff
// and never blurs into the creep. A brighter leading-edge segment (a pure
// --foreground luminance lift, never --ns-accent) flashes on that kick and
// eases back to the fill's resting opacity over 150ms.
//
// One real-time cycle = 3.2s (2.9s wind + 0.3s trip), compressed ~9.4x from
// a typical 30s precision-clock rearm interval — a discrete event, not a
// continuous oscillation, so it sits clear of any paint-rate aliasing band.
// The whole thing runs on one rAF loop keyed off real elapsed time (never
// frame count), self-driven, unbounded — nothing here waits on input.
//
// Optional controlled `value` (0-100) lets this sit on a real transfer: the
// bar's overall width then tracks `value` directly and the wind/trip cycle
// keeps running underneath purely as "work is happening" chrome layered on
// top, never touching the actual fill width itself.
// ---------------------------------------------------------------------------

const WIND_MS = 2900;
const TRIP_MS = 300;
const CYCLE_MS = WIND_MS + TRIP_MS;
const CREEP_PCT_PER_MS = 0.3 / 1000; // 0.3%/s
const TRIP_JUMP_PCT = 6;
const WIND_EASE_POWER = 1.6; // ease-in: slow start, accelerating tighten
const TURNS_RELAXED = 5;
const TURNS_WOUND = 2;
const FLASH_MS = 150;

const TRIP_BEZIER: [number, number, number, number] = [0.2, 1.4, 0.4, 1]; // one small overshoot

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function bez1d(u: number, a: number, b: number, c: number, d: number) {
  const mu = 1 - u;
  return mu * mu * mu * a + 3 * mu * mu * u * b + 3 * mu * u * u * c + u * u * u * d;
}

// Solves x(u) = t for a cubic bezier anchored at (0,0)/(1,1) via bisection
// (x is monotonic since p1x/p2x sit in [0,1]), returns y(u) — which CAN
// exceed 1 mid-curve when a control point's y does, giving the overshoot.
function cubicBezierEase(t: number, [p1x, p1y, p2x, p2y]: [number, number, number, number]) {
  let lo = 0;
  let hi = 1;
  let u = t;
  for (let i = 0; i < 20; i++) {
    u = (lo + hi) / 2;
    const x = bez1d(u, 0, p1x, p2x, 1);
    if (x < t) lo = u;
    else hi = u;
  }
  return bez1d(u, 0, p1y, p2y, 1);
}

// Samples the coil as a plain sine wave across a 0-100 x span and returns an
// SVG path `d`. `turns` is the (continuous) number of full periods visible —
// fewer turns at the same span reads as coils bunched/compressed together,
// more turns reads as the loose, fully relaxed spring.
function springPath(turns: number, amplitude: number, samples: number) {
  let d = "";
  for (let i = 0; i <= samples; i++) {
    const x = (i / samples) * 100;
    const y = 12 + amplitude * Math.sin((i / samples) * turns * Math.PI * 2);
    d += i === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : `L${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
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

export interface RemontoireRewindProps {
  /** real transfer progress, 0-100. Omit to let the remontoire drive its own idle loop. */
  value?: number;
  /** visible + accessible label, e.g. "Syncing workspace" (default "Sync progress") */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function RemontoireRewind({ value, label = "Sync progress", className = "" }: RemontoireRewindProps) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const reduced = useReducedMotion();

  const rootRef = useRef<HTMLDivElement>(null);
  const springRef = useRef<SVGPathElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const controlledValueRef = useRef(value);
  controlledValueRef.current = value;

  useEffect(() => {
    const root = rootRef.current;
    const spring = springRef.current;
    const fill = fillRef.current;
    const flash = flashRef.current;
    if (!root || !spring || !fill || !flash) return;

    let disposed = false;
    let visible = true;
    let raf = 0;

    // uncontrolled accumulation: how much of the strip the remontoire itself
    // has "delivered" so far this wrap, independent of any controlled value.
    let internalFill = 0;
    let fillAtTripStart = 0;
    let cycleStart = 0;
    let lastPhase: "wind" | "trip" = "wind";

    const paint = (now: number) => {
      let elapsed = now - cycleStart;
      if (elapsed >= CYCLE_MS) {
        const wraps = Math.floor(elapsed / CYCLE_MS);
        cycleStart += wraps * CYCLE_MS;
        elapsed -= wraps * CYCLE_MS;
      }

      let turns: number;
      let tripped = false;

      if (elapsed < WIND_MS) {
        const t = elapsed / WIND_MS;
        turns = TURNS_RELAXED - (TURNS_RELAXED - TURNS_WOUND) * Math.pow(t, WIND_EASE_POWER);
        if (lastPhase === "trip") {
          // just re-entered wind on a fresh cycle: lock in the post-trip baseline
          fillAtTripStart = internalFill;
        }
        lastPhase = "wind";
        internalFill = fillAtTripStart + elapsed * CREEP_PCT_PER_MS;
      } else {
        const t = clamp((elapsed - WIND_MS) / TRIP_MS, 0, 1);
        const eased = cubicBezierEase(t, TRIP_BEZIER);
        turns = TURNS_WOUND + (TURNS_RELAXED - TURNS_WOUND) * eased;
        if (lastPhase === "wind") fillAtTripStart = internalFill;
        lastPhase = "trip";
        const jumpEase = 1 - Math.pow(1 - t, 3); // ease-out, distinct kick
        internalFill = fillAtTripStart + jumpEase * TRIP_JUMP_PCT;
        tripped = t >= 1;
      }

      if (internalFill >= 100) internalFill -= 100; // seamless wrap, no pause at the seam

      const controlled = controlledValueRef.current;
      const displayFill = controlled === undefined ? internalFill : clamp(controlled, 0, 100);

      spring.setAttribute("d", springPath(turns, 4.5, 48));
      fill.style.width = `${displayFill}%`;

      if (tripped) {
        flash.style.transition = "none";
        flash.style.opacity = "1";
        // next frame: ease the flash back down over FLASH_MS
        requestAnimationFrame(() => {
          if (disposed) return;
          flash.style.transition = `opacity ${FLASH_MS}ms ease-out`;
          flash.style.opacity = "0";
        });
      }
    };

    const loop = (now: number) => {
      if (!visible) {
        raf = 0;
        return;
      }
      paint(now);
      raf = requestAnimationFrame(loop);
    };

    if (reduced) {
      // Deliberately chosen non-t0, most-structured freeze: mid-wind (turns
      // clearly between fully coiled and fully tripped) with the bar sitting
      // just after a trip-jump, so it reads as "a mechanism mid-cycle".
      spring.setAttribute("d", springPath(3.5, 4.5, 48));
      const controlled = controlledValueRef.current;
      fill.style.width = `${controlled === undefined ? 46 : clamp(controlled, 0, 100)}%`;
      flash.style.transition = "none";
      flash.style.opacity = "0.55";
    } else {
      cycleStart = performance.now();
      raf = requestAnimationFrame(loop);
    }

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced && !raf) raf = requestAnimationFrame(loop);
    });
    io.observe(root);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `value` is read live via controlledValueRef, not a loop dependency
  }, [reduced]);

  const valueNow = value === undefined ? undefined : Math.round(clamp(value, 0, 100));

  return (
    <div ref={rootRef} className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span id={labelId} className="font-mono text-xs text-ns-muted">
          {label}
        </span>
        {valueNow !== undefined ? (
          <span className="font-mono text-xs tabular-nums text-foreground" aria-hidden>
            {valueNow}%
          </span>
        ) : null}
      </div>

      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        className="mb-1 h-6 w-full text-foreground"
      >
        <path ref={springRef} d="" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={valueNow}
        aria-valuetext={valueNow === undefined ? "Syncing" : `${valueNow}%`}
        className="relative h-1.5 overflow-hidden rounded-full border border-border bg-ns-muted/20"
      >
        <div ref={fillRef} className="absolute inset-y-0 left-0 w-0 rounded-full bg-foreground/85">
          <div ref={flashRef} className="absolute inset-y-0 right-0 w-2.5 rounded-full bg-foreground opacity-0" />
        </div>
      </div>
    </div>
  );
}
