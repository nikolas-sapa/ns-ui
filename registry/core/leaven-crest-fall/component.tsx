"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// LeavenCrestFall — a sourdough starter jar rendered as a live status
// gauge: the surface dome rises to a blistered peak on CO2 from
// fermentation, then collapses as gas escapes, fed again, and rises again —
// forever. Card-scale SVG only, no canvas.
//
// TIMING. One cycle is 12.6s: an 8s logistic RISE from a residual settled
// height up to 2.4x that baseline, a 4s exponential-decay FALL back down to
// ~1.05x baseline (real starter never returns fully flat — a thin residual
// film/height is what's left before the next feed), then a 600ms FEED pulse
// (a brief brightness flash standing in for fresh flour/water going in)
// before the next rise starts. `n(t)` in [0,1] is the normalised rise
// fraction; the dome's height multiplier is `1 + 1.4*n`, so n=0 is baseline
// (1.0x) and n=1 is peak (2.4x). N_SETTLE = 0.05/1.4 ~= 0.0357 is the floor
// n never goes below after a fall, which is exactly what keeps the fall's
// exponential decay landing at 1.05x rather than 1.0x.
//
// DOME SHAPE. The surface is sampled at DOME_SAMPLES x-positions across the
// jar's interior width every frame; each sample's y-offset above the
// baseline is `riseAmplitude(t) * bump(x)` (a raised-cosine bump, zero at
// the jar walls, 1 at the centre) plus a small two-harmonic ripple that
// slowly rotates phase over wall-clock time — the ripple's job is purely to
// keep the surface visibly non-static during any *flat-ish* stretch of the
// rise/fall curve (e.g. right at the peak hold), independent of the
// rise/fall amplitude itself. Samples are joined into one smooth path with
// successive quadratic curves through each pair's midpoint (a cheap
// Catmull-Rom-ish smoothing that needs no extra library), then closed down
// to the jar's fixed floor to fill the whole starter body.
//
// BUBBLES. Surface blistering is a real Poisson arrival process, not
// decoration bolted on top: during the rise phase only, each frame has a
// `LAMBDA * dt` chance of nucleating one new bubble at a random x along the
// dome, with radius growing as `R0 * age^0.3` up to MAX_R (the real
// power-law growth shape of a gas bubble breaking a viscous surface, capped
// for legibility). During the fall phase the live population is walked DOWN
// to a target count computed directly from n(t) — `target =
// peakCount * (n - N_SETTLE) / (1 - N_SETTLE)` — so the number of bubbles on
// screen is causally tied to the height curve's own decay, not an
// independently-timed decoration; bubbles at or below the target are told to
// pop (radius eased to 0 over 120ms, smallest first) exactly as fast as the
// dome itself is falling. A fixed-size pool of BUBBLE_POOL <circle> elements
// is pre-rendered once and reused (r set to 0 when inactive) so the DOM node
// count never changes across a cycle.
//
// Every per-frame numeric write (the dome path's `d`, each bubble's cx/cy/r,
// the feed-flash overlay's opacity) goes straight to the DOM via refs inside
// one rAF loop — no per-frame setState, so React never re-renders during
// the animation. A single low-frequency (~1Hz) status-text update is the
// only state write once mounted.
//
// prefers-reduced-motion freezes at t=8000ms of the 12.6s cycle (the crest
// exactly at its peak: maximum dome height, maximum bubble count) — the
// most structured, information-dense frame, deliberately not t0. That exact
// state is precomputed once from a small seeded PRNG so a reduced-motion
// render is deterministic rather than "whatever the rAF loop happened to be
// doing when it got told to stop."
//
// Colours are read straight off CSS custom properties in every fill/stroke
// (var(--foreground)/var(--ns-muted)/var(--border)/var(--background)) —
// zero literals, zero getComputedStyle: a theme flip repaints for free.
// Geometry lives in one fixed SVG viewBox scaled by preserveAspectRatio
// ("xMidYMid meet"), which is what makes it read at card scale — the
// coordinate system is uniformly fit to whichever of the container's two
// dimensions is smaller, the same mechanism `cambium-lay` uses.
// ---------------------------------------------------------------------------

export interface LeavenCrestFallProps {
  className?: string;
}

const VB_W = 200;
const VB_H = 220;

const JAR_LEFT = 46;
const JAR_RIGHT = 154;
const JAR_TOP = 20;
const JAR_BOTTOM = 196;
const JAR_CX = (JAR_LEFT + JAR_RIGHT) / 2;

const BASE_Y = 108; // baseline (1.0x) dome surface height
const CREST_MAX_RISE = 48; // viewBox units of headspace the crest can climb into at n=1

const RISE_MS = 8000;
const FALL_MS = 4000;
const FEED_MS = 600;
const CYCLE_MS = RISE_MS + FALL_MS + FEED_MS; // 12600

const N_SETTLE = 0.05 / 1.4; // ~0.0357 — floor n never falls below
const RISE_SIGMOID_K = 9; // logistic steepness

const DOME_SAMPLES = 22;
const RIPPLE_AMPL = 1.1;
const RIPPLE_OMEGA = 0.5; // rad/s — slow phase rotation, keeps the surface alive even mid-plateau

const LAMBDA = 0.8; // bubbles/sec nucleation rate during rise
const R0 = 1.4;
const MAX_R = 3.4;
const POP_MS = 120;
const BUBBLE_POOL = 30;

type Bubble = {
  active: boolean;
  x: number;
  birth: number; // ms, performance.now() timestamp
  r: number;
  poppingAt: number | null;
  poppedFromR: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

// normalised sigmoid: sig(0)=0, sig(1)=1
function sigmoidNorm(u: number, k: number): number {
  const s0 = 1 / (1 + Math.exp(k * 0.5));
  const s1 = 1 / (1 + Math.exp(-k * 0.5));
  const s = 1 / (1 + Math.exp(-k * (u - 0.5)));
  return (s - s0) / (s1 - s0);
}

// n(t) for t = ms elapsed within one cycle, in [0, CYCLE_MS)
function riseFraction(cycleT: number): number {
  if (cycleT < RISE_MS) {
    const u = cycleT / RISE_MS;
    return N_SETTLE + (1 - N_SETTLE) * sigmoidNorm(u, RISE_SIGMOID_K);
  }
  if (cycleT < RISE_MS + FALL_MS) {
    const u = (cycleT - RISE_MS) / FALL_MS;
    return N_SETTLE + (1 - N_SETTLE) * Math.exp(-3 * u);
  }
  return N_SETTLE;
}

// derivative-ish phase flag: are we in the fall window right now
function isFalling(cycleT: number): boolean {
  return cycleT >= RISE_MS && cycleT < RISE_MS + FALL_MS;
}

function isFeeding(cycleT: number): boolean {
  return cycleT >= RISE_MS + FALL_MS;
}

function bumpFn(u: number): number {
  // raised cosine (Hann window), u in [0,1]: 0 at both edges, 1 at centre
  return (1 - Math.cos(u * Math.PI * 2)) / 2;
}

function domeAmplitude(n: number): number {
  return CREST_MAX_RISE * n;
}

function buildDomePath(sampleYs: number[], sampleXs: number[]): string {
  const n = sampleYs.length;
  let d = `M ${sampleXs[0]},${sampleYs[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const mx = (sampleXs[i] + sampleXs[i + 1]) / 2;
    const my = (sampleYs[i] + sampleYs[i + 1]) / 2;
    d += ` Q ${sampleXs[i]},${sampleYs[i]} ${mx},${my}`;
  }
  d += ` L ${sampleXs[n - 1]},${sampleYs[n - 1]} L ${JAR_RIGHT},${JAR_BOTTOM} L ${JAR_LEFT},${JAR_BOTTOM} Z`;
  return d;
}

// Deterministic seeded PRNG (mulberry32) so the reduced-motion frame is stable.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildReducedFrame(): { domeD: string; bubbles: { x: number; y: number; r: number }[] } {
  const n = riseFraction(RISE_MS); // exactly the peak, n -> 1
  const amp = domeAmplitude(n);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < DOME_SAMPLES; i++) {
    const u = i / (DOME_SAMPLES - 1);
    const x = JAR_LEFT + u * (JAR_RIGHT - JAR_LEFT);
    const y = BASE_Y - amp * bumpFn(u);
    xs.push(x);
    ys.push(y);
  }
  const domeD = buildDomePath(ys, xs);

  const rnd = mulberry32(1337);
  const bubbles: { x: number; y: number; r: number }[] = [];
  const count = 14; // representative peak-population count for the frozen frame
  for (let i = 0; i < count; i++) {
    const u = 0.08 + rnd() * 0.84;
    const x = JAR_LEFT + u * (JAR_RIGHT - JAR_LEFT);
    const y = BASE_Y - amp * bumpFn(u) - 1.5;
    const r = R0 + rnd() * (MAX_R - R0);
    bubbles.push({ x, y, r });
  }
  return { domeD, bubbles };
}

export function LeavenCrestFall({ className = "" }: LeavenCrestFallProps) {
  const [reduced, setReduced] = useState(false);
  const [statusText, setStatusText] = useState("sourdough starter rising");

  const domeRef = useRef<SVGPathElement | null>(null);
  const flashRef = useRef<SVGPathElement | null>(null);
  const bubbleRefs = useRef<(SVGCircleElement | null)[]>([]);
  const bubblesRef = useRef<Bubble[]>(
    Array.from({ length: BUBBLE_POOL }, () => ({
      active: false,
      x: 0,
      birth: 0,
      r: 0,
      poppingAt: null,
      poppedFromR: 0,
    })),
  );
  const peakCountRef = useRef(0);
  const wasFallingRef = useRef(false);
  const startRef = useRef(0);
  const rafRef = useRef(0);
  const lastStatusRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;

    startRef.current = performance.now();
    lastStatusRef.current = 0;

    const step = (now: number) => {
      const elapsed = now - startRef.current;
      const cycleT = elapsed % CYCLE_MS;
      const n = riseFraction(cycleT);
      const amp = domeAmplitude(n);
      const falling = isFalling(cycleT);
      const feeding = isFeeding(cycleT);

      if (falling && !wasFallingRef.current) {
        peakCountRef.current = bubblesRef.current.filter((b) => b.active && b.poppingAt === null).length;
      }
      wasFallingRef.current = falling;

      // -- dome surface --
      const xs: number[] = [];
      const ys: number[] = [];
      const t = elapsed / 1000;
      for (let i = 0; i < DOME_SAMPLES; i++) {
        const u = i / (DOME_SAMPLES - 1);
        const x = JAR_LEFT + u * (JAR_RIGHT - JAR_LEFT);
        const ripple =
          RIPPLE_AMPL *
          (0.6 * Math.sin(3 * u * Math.PI * 2 + t * RIPPLE_OMEGA) +
            0.4 * Math.sin(5 * u * Math.PI * 2 - t * RIPPLE_OMEGA * 1.3)) *
          bumpFn(u);
        const y = BASE_Y - amp * bumpFn(u) + ripple;
        xs.push(x);
        ys.push(y);
      }
      if (domeRef.current) {
        domeRef.current.setAttribute("d", buildDomePath(ys, xs));
      }

      // -- feed flash --
      if (flashRef.current) {
        let flashOpacity = 0;
        if (feeding) {
          const u = (cycleT - RISE_MS - FALL_MS) / FEED_MS;
          flashOpacity = Math.sin(Math.PI * clamp(u, 0, 1)) * 0.35;
        }
        flashRef.current.setAttribute("opacity", flashOpacity.toFixed(3));
      }

      // -- bubbles: nucleate during rise --
      const bubbles = bubblesRef.current;
      if (!falling && !feeding) {
        const dtSpawn = 1 / 60; // approximate per-frame window for the Poisson check
        if (Math.random() < LAMBDA * dtSpawn) {
          const free = bubbles.findIndex((b) => !b.active);
          if (free !== -1) {
            const u = 0.06 + Math.random() * 0.88;
            bubbles[free] = {
              active: true,
              x: JAR_LEFT + u * (JAR_RIGHT - JAR_LEFT),
              birth: now,
              r: 0,
              poppingAt: null,
              poppedFromR: 0,
            };
          }
        }
      }

      // -- bubbles: pop down toward target during fall --
      if (falling) {
        const target = Math.round(
          peakCountRef.current * clamp((n - N_SETTLE) / (1 - N_SETTLE), 0, 1),
        );
        const live = bubbles
          .map((b, i) => ({ b, i }))
          .filter((x) => x.b.active && x.b.poppingAt === null)
          .sort((a, c) => a.b.r - c.b.r); // smallest first
        const excess = live.length - target;
        for (let k = 0; k < excess; k++) {
          const entry = live[k];
          entry.b.poppingAt = now;
          entry.b.poppedFromR = entry.b.r;
        }
      }

      // -- bubbles: advance radius / render --
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        const el = bubbleRefs.current[i];
        if (!b.active) {
          if (el) el.setAttribute("r", "0");
          continue;
        }
        if (b.poppingAt !== null) {
          const u = clamp((now - b.poppingAt) / POP_MS, 0, 1);
          b.r = b.poppedFromR * (1 - u);
          if (u >= 1) {
            b.active = false;
            b.poppingAt = null;
          }
        } else {
          const ageSec = (now - b.birth) / 1000;
          b.r = Math.min(MAX_R, R0 * Math.pow(Math.max(ageSec, 0.001), 0.3) - R0 * 0.4);
          b.r = clamp(b.r, 0, MAX_R);
        }
        if (el) {
          const u = clamp((b.x - JAR_LEFT) / (JAR_RIGHT - JAR_LEFT), 0, 1);
          const y = BASE_Y - amp * bumpFn(u) - b.r * 0.7;
          el.setAttribute("cx", b.x.toFixed(2));
          el.setAttribute("cy", y.toFixed(2));
          el.setAttribute("r", Math.max(0, b.r).toFixed(2));
        }
      }

      if (now - lastStatusRef.current > 900) {
        lastStatusRef.current = now;
        setStatusText(
          feeding
            ? "sourdough starter fed, beginning to rise"
            : falling
              ? "sourdough starter collapsing"
              : "sourdough starter rising",
        );
      }

      rafRef.current = window.requestAnimationFrame(step);
    };

    rafRef.current = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafRef.current);
  }, [reduced]);

  const reducedFrame = reduced ? buildReducedFrame() : null;

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`} data-leaven-crest-fall>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none block h-full w-full"
      >
        {/* jar outline */}
        <path
          d={`M ${JAR_LEFT},${JAR_TOP} L ${JAR_LEFT},${JAR_BOTTOM - 14} Q ${JAR_LEFT},${JAR_BOTTOM} ${JAR_LEFT + 14},${JAR_BOTTOM} L ${JAR_RIGHT - 14},${JAR_BOTTOM} Q ${JAR_RIGHT},${JAR_BOTTOM} ${JAR_RIGHT},${JAR_BOTTOM - 14} L ${JAR_RIGHT},${JAR_TOP}`}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1.5}
        />
        {/* baseline fill mark, the rubber-band bakers use to track rise */}
        <line
          x1={JAR_LEFT - 4}
          y1={BASE_Y}
          x2={JAR_LEFT + 3}
          y2={BASE_Y}
          stroke="var(--border)"
          strokeWidth={1.5}
        />

        {reduced && reducedFrame ? (
          <>
            <path d={reducedFrame.domeD} fill="var(--ns-muted)" />
            {reducedFrame.bubbles.map((b, i) => (
              <circle
                key={i}
                cx={b.x}
                cy={b.y}
                r={b.r}
                fill="none"
                stroke="var(--foreground)"
                strokeWidth={0.6}
              />
            ))}
          </>
        ) : (
          <>
            <path ref={domeRef} fill="var(--ns-muted)" d="" />
            {Array.from({ length: BUBBLE_POOL }).map((_, i) => (
              <circle
                key={i}
                ref={(el) => {
                  bubbleRefs.current[i] = el;
                }}
                cx={0}
                cy={0}
                r={0}
                fill="none"
                stroke="var(--foreground)"
                strokeWidth={0.6}
              />
            ))}
            <path
              ref={flashRef}
              d={`M ${JAR_LEFT},${BASE_Y} L ${JAR_RIGHT},${BASE_Y} L ${JAR_RIGHT},${JAR_BOTTOM} L ${JAR_LEFT},${JAR_BOTTOM} Z`}
              fill="var(--foreground)"
              opacity={0}
            />
          </>
        )}
      </svg>
      <span role="status" aria-live="polite" className="sr-only">
        {statusText}
      </span>
    </div>
  );
}
