"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// SpiralChuteAccrete — a full-bleed ambient background reproducing a gravity
// spiral chute: the helical slide sorting facilities and department-store
// stockrooms use to move parcels/mail sacks between floors without powered
// conveyance. Small parcels enter at the top, slide down a continuous
// helical ramp under gravity alone (friction + the helix's banking keeps
// speed roughly bounded rather than accelerating), and pile up in a landing
// area at the base until the pile is swept clear.
//
// EVERYTHING IS A PURE FUNCTION OF ONE CLOCK. Rather than mutating an array
// of live parcel/tile objects frame to frame, every quantity drawn — which
// parcels are in flight, where each sits on the helix, which tiles are in
// the current pile, which are mid-sweep-out — is derived straight from the
// elapsed clock t (ms) and a fixed spawn index k. That is what makes the
// state reproducible for prefers-reduced-motion: freezing the clock at a
// named STATIC_T freezes the exact same layout every time, with no history
// to serialize.
//
//   spawn(k)   = k * SPAWN_INTERVAL_MS                      (top of chute)
//   land(k)    = spawn(k) + TRANSIT_MS                      (base of chute)
//   in flight  = spawn(k) <= t < land(k)   -> theta = (t-spawn(k))/TRANSIT_MS * THETA_MAX
//   landed     = land(k) <= t              -> becomes one pile tile
//
// PILE / SWEEP: the base landing area fills with one tile per landed
// parcel, positioned by a period-9 deterministic jitter sequence keyed off
// k % 9 (never per-frame randomness, so the pile shape is exactly
// reproducible). Every SWEEP_PERIOD_MS the chute's current 9s fill cycle
// ends and the NEXT cycle's landings start a fresh pile; the tiles that
// belong to the cycle which just ended slide off to one side over
// SWEEP_DURATION_MS, staggered SWEEP_STAGGER_MS apart, for the first
// SWEEP_DURATION_MS of the new cycle only. This is derived directly from
// `t % SWEEP_PERIOD_MS`, so a pile can never accumulate past one fill
// cycle's worth of tiles and never breaches the canvas edge.
//
// REAL NUMBERS (all fixed, real-world-derived, not tuned per frame): a
// parcel takes TRANSIT_MS to cross THE FULL 3.5 turns of the helix — this
// is one of the rare cases where the legible rate and the real rate are
// close, so descent renders close to real proportion instead of being
// artificially decoupled. New parcels spawn every SPAWN_INTERVAL_MS, which
// at a 3.6s transit keeps 2-3 parcels in flight simultaneously, each at a
// different theta so they never overlap on the same winding — this
// simultaneous-parcel count, not a faster descent, is the intended legible
// signal for "alive," per the spec's own kill criteria.
//
// TOKENS: the ramp track itself is the least important thing on screen —
// it renders at --ns-muted, a low, border-like contrast step, so it reads
// as track rather than subject. Parcels and pile tiles are the moving
// subject and render at --foreground so they clear the ramp with a real
// luminance step in both themes. --ns-accent never appears; nothing here
// is interaction chrome, and the pile-sweep moment (this component's one
// climactic event) is a --foreground fade/slide only.
// ---------------------------------------------------------------------------

const TRANSIT_MS = 3600; // one parcel's full top-to-bottom transit
const SPAWN_INTERVAL_MS = 1300; // cadence of new parcels entering at the top
const TURNS = 3.5; // total revolutions top -> bottom
const THETA_MAX = TURNS * Math.PI * 2;
const SWEEP_PERIOD_MS = 9000; // pile fill/clear cycle length
const SWEEP_DURATION_MS = 500; // how long a sweep-out takes
const SWEEP_STAGGER_MS = 30; // stagger between tiles sliding away
const RADIUS_FACTOR = 0.32; // spiral radius, as a fraction of min(w,h)
const RAMP_TOP_FRAC = 0.1; // top margin, fraction of container height
const RAMP_HEIGHT_FRAC = 0.68; // vertical extent of the helix, fraction of height
const RAMP_SAMPLES = 240; // points used to build the cached ramp path
const PARCEL_SIZE_FRAC = 0.05; // parcel edge length, fraction of min(w,h)
const PILE_JITTER_FRAC = 0.075; // pile scatter radius, fraction of min(w,h)

// deterministic period-9 jitter sequence (unit-ish offsets), keyed by
// spawn index k % 9 — fixed, not per-frame random, so the pile shape is
// reproducible frame to frame and across prefers-reduced-motion runs.
const PILE_OFFSETS: readonly [number, number][] = [
  [0.12, -0.22],
  [-0.38, 0.14],
  [0.44, 0.3],
  [-0.14, -0.42],
  [0.05, 0.42],
  [-0.46, -0.08],
  [0.26, -0.36],
  [-0.2, 0.36],
  [0.4, 0.04],
];

// prefers-reduced-motion freeze frame: named MID_DESCENT. Chosen mid-cycle
// (71.7% into a 9s fill) so the pile is roughly half of a full cycle's
// worth of tiles (3 landed of ~5 max) rather than freshly swept or about
// to overflow, with two parcels still in flight at clearly different theta
// — spiral, motion-implying spacing and an in-progress pile all visible
// in one static composition.
const STATIC_T = 6450;

// live-mode warm start: t=0 on a bare clock is a near-empty chute (one
// parcel just spawned, pile empty) — the spec's own t0 requirement is
// "2-3 parcels visible at different points on the spiral, plus a partial
// pile." Starting the live clock here instead of at 0 makes t0 already
// alive without changing any rate: k=2/k=3 in flight (theta .71/.35),
// pile at 2 tiles. Deliberately a different phase than STATIC_T so the
// reduced-motion freeze is never mistaken for "just t0."
const WARM_START_MS = 5150;

function landTimeForIndex(k: number): number {
  return k * SPAWN_INTERVAL_MS + TRANSIT_MS;
}

interface FlightParcel {
  k: number;
  progress: number; // 0..1 along the helix
}

interface PileTile {
  k: number;
  sweepProgress: number; // 0 = resting in pile, 1 = fully slid away
}

/** Parcels currently in flight (spawned, not yet landed) at clock t. */
function computeFlight(t: number): FlightParcel[] {
  const out: FlightParcel[] = [];
  const maxK = Math.floor(t / SPAWN_INTERVAL_MS);
  for (let k = Math.max(0, maxK - 4); k <= maxK; k++) {
    const spawnAt = k * SPAWN_INTERVAL_MS;
    if (spawnAt < 0 || spawnAt > t) continue;
    const landAt = landTimeForIndex(k);
    if (t >= landAt) continue;
    out.push({ k, progress: (t - spawnAt) / TRANSIT_MS });
  }
  return out;
}

/**
 * The pile as it should render at clock t: tiles landed in the CURRENT
 * fill cycle (sweepProgress 0, resting), plus — for the first
 * SWEEP_DURATION_MS of a new cycle only — the previous cycle's tiles,
 * staggered mid-slide-away.
 */
function computePile(t: number): PileTile[] {
  if (t < 0) return [];
  const cycleIndex = Math.floor(t / SWEEP_PERIOD_MS);
  const cycleStart = cycleIndex * SWEEP_PERIOD_MS;
  const sinceCycleStart = t - cycleStart;

  const out: PileTile[] = [];

  // current cycle's own landings so far
  const currentMaxK = Math.floor((t - TRANSIT_MS) / SPAWN_INTERVAL_MS);
  for (let k = Math.max(0, currentMaxK - 8); k <= currentMaxK; k++) {
    const landAt = landTimeForIndex(k);
    if (landAt > cycleStart && landAt <= t) {
      out.push({ k, sweepProgress: 0 });
    }
  }

  // previous cycle's tiles, still sliding away in the first
  // SWEEP_DURATION_MS of this cycle
  if (cycleIndex > 0 && sinceCycleStart < SWEEP_DURATION_MS) {
    const prevCycleStart = cycleStart - SWEEP_PERIOD_MS;
    const prevMaxK = Math.floor((cycleStart - TRANSIT_MS) / SPAWN_INTERVAL_MS);
    const prevTiles: number[] = [];
    for (let k = Math.max(0, prevMaxK - 8); k <= prevMaxK; k++) {
      const landAt = landTimeForIndex(k);
      if (landAt > prevCycleStart && landAt <= cycleStart) prevTiles.push(k);
    }
    prevTiles.sort((a, b) => a - b);
    prevTiles.forEach((k, i) => {
      const localStart = i * SWEEP_STAGGER_MS;
      const local = sinceCycleStart - localStart;
      const span = SWEEP_DURATION_MS - localStart;
      const p = span <= 0 ? 1 : Math.max(0, Math.min(1, local / span));
      if (p < 1) out.push({ k, sweepProgress: p });
    });
  }

  return out;
}

function easeOut(p: number): number {
  return 1 - (1 - p) * (1 - p);
}

export interface SpiralChuteAccreteProps {
  /** headline / CTA rendered centered over the chute */
  children?: ReactNode;
  /** extra classes merged onto the root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: React.CSSProperties;
}

export function SpiralChuteAccrete({
  children,
  className = "",
  style,
}: SpiralChuteAccreteProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // token fields start empty; nothing paints until readTokens() has run
    // at least once (guarded in draw() below) — closes every path (rAF
    // start, resize, IntersectionObserver resume) that could otherwise
    // paint a literal color before the first token read.
    let mutedColor = "";
    let fgColor = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      mutedColor = cs.getPropertyValue("--ns-muted").trim();
      fgColor = cs.getPropertyValue("--foreground").trim();
    };

    let w = 0;
    let h = 0;
    let cx = 0;
    let radius = 0;
    let topY = 0;
    let rampHeight = 0;
    let baseX = 0;
    let baseY = 0;
    let parcelSize = 0;
    let pileJitter = 0;
    let sized = false;
    let visible = true;
    let raf = 0;
    let last = 0;
    let t = reduced ? STATIC_T : WARM_START_MS;

    // cached ramp path samples, rebuilt only on resize (geometry never
    // changes per frame — only scale/position do).
    let rampPath: Path2D | null = null;

    const pointOnHelix = (theta: number) => {
      const x = cx + radius * Math.sin(theta);
      const y = topY + (theta / THETA_MAX) * rampHeight;
      return [x, y] as const;
    };

    const buildRampPath = () => {
      const path = new Path2D();
      for (let i = 0; i <= RAMP_SAMPLES; i++) {
        const theta = (i / RAMP_SAMPLES) * THETA_MAX;
        const [x, y] = pointOnHelix(theta);
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      rampPath = path;
      const [bx, by] = pointOnHelix(THETA_MAX);
      baseX = bx;
      baseY = by;
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      const isCard = !!canvas.closest("[data-autoplay-root]");
      const dpr = isCard
        ? Math.min(0.75, window.devicePixelRatio || 1)
        : Math.min(window.devicePixelRatio || 1, 1.5);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const minDim = Math.min(w, h);
      cx = w / 2;
      // clamp against w/2 as well as min(w,h) — a container taller than
      // wide would otherwise let the helix clip both side edges.
      radius = Math.min(RADIUS_FACTOR * minDim, w * 0.4);
      topY = h * RAMP_TOP_FRAC;
      rampHeight = h * RAMP_HEIGHT_FRAC;
      parcelSize = Math.max(3, minDim * PARCEL_SIZE_FRAC);
      pileJitter = minDim * PILE_JITTER_FRAC;
      sized = true;
      buildRampPath();
    };

    const drawSquare = (x: number, y: number, size: number, alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    };

    const draw = () => {
      if (!sized || !fgColor || !mutedColor || !rampPath) return;
      ctx.clearRect(0, 0, w, h);

      // ramp track: the track, not the subject — low, border-like contrast
      ctx.globalAlpha = 1;
      ctx.strokeStyle = mutedColor;
      // floored well above the raw radius*0.02 scale — at card-preview
      // size (~400px, dpr 0.75) that scale alone thins under 2px and the
      // ramp risks disappearing on a light background, the exact failure
      // the spec calls out. Alpha raised to match; parcels/pile still
      // dominate at 0.92-0.95 --foreground.
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(1.5, radius * 0.02);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke(rampPath);

      // pile: current cycle's tiles plus any mid-sweep leftovers
      ctx.fillStyle = fgColor;
      const pile = computePile(t);
      for (const tile of pile) {
        const [ox, oy] = PILE_OFFSETS[((tile.k % 9) + 9) % 9];
        const slideX = tile.sweepProgress > 0 ? easeOut(tile.sweepProgress) * (w * 0.7) : 0;
        const x = baseX + ox * pileJitter + slideX;
        const y = baseY + oy * pileJitter * 0.6;
        const alpha = 0.92 * (1 - tile.sweepProgress);
        if (alpha > 0.01) drawSquare(x, y, parcelSize * 0.9, alpha);
      }

      // in-flight parcels on the helix
      const flight = computeFlight(t);
      for (const parcel of flight) {
        const theta = parcel.progress * THETA_MAX;
        const [x, y] = pointOnHelix(theta);
        drawSquare(x, y, parcelSize, 0.95);
      }

      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(50, now - last) : 1000 / 60;
      last = now;
      t += dt;
      draw();
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw();
      }, 120);
    });
    ro.observe(root);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && !reduced && !raf) {
          last = 0;
          raf = requestAnimationFrame(loop);
        }
      },
      { threshold: 0 }
    );
    io.observe(root);

    const onVis = () => {
      if (!document.hidden && visible && !reduced && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced || !raf) draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    readTokens();
    resize();

    if (reduced) {
      draw();
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative isolate min-h-screen w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
      {children ? (
        <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center gap-4 px-6 text-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}
