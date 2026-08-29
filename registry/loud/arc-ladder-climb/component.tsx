"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// ArcLadderClimb — a full-bleed section-divider background modelled on a
// Jacob's ladder: two bare rails diverge upward at a fixed angle from a
// narrow gap at the bottom-center. The field is always strongest at that
// gap, so an arc always strikes there first; buoyancy plus the widening
// rail geometry drags it upward, and the climbing gap eventually exceeds
// what the "supply" can sustain, so the arc dies and a fresh one restrikes
// at the base almost immediately. One continuous rAF loop drives a single
// arc through a climbing/dark phase machine — never a per-frame random
// reset — so the SAME cycle logic used for the live frame also produces the
// reduced-motion freeze and survives a background tab's dropped frames by
// catching up through however many completed phases elapsed, exactly like
// plasma-filament-wander's advanceFilament.
//
// The arc's own polyline jitter is resampled from a hashed pseudo-random
// function keyed on a 24Hz time-bucket (~41.7ms), not the 60Hz paint clock
// — the round-9 aliasing lesson: a real HV arc flickers near mains
// frequency, so it is deliberately decoupled from 1:1 frame-rate rendering
// rather than driving the redraw off it. A short trail of 2-3 previously
// sampled climb heights is kept alongside the live arc and drawn underneath
// it at falling opacity, reading as heated air rather than a static rung.
// ---------------------------------------------------------------------------

const HALF_ANGLE_DEG = 7;
const HALF_ANGLE_TAN = Math.tan((HALF_ANGLE_DEG * Math.PI) / 180);
const BASE_GAP_FRAC = 0.014; // of minDim
const CLIMB_START_PX = 4; // scaled
const CLIMB_MAX_FRAC = 0.85; // of container height
const CLIMB_EASE = 2; // easeInQuad

const PERIOD_MIN_MS = 1600;
const PERIOD_MAX_MS = 2200;
const CLIMB_FRAC_OF_PERIOD = 0.78;
const DARK_MIN_MS = 120;
const DARK_MAX_MS = 220;

const JITTER_BUCKET_MS = 1000 / 24; // 24Hz, decoupled from the 60Hz paint loop
const JITTER_MIN_PX = 3;
const JITTER_MAX_PX = 7;
const VERTS_MIN = 5;
const VERTS_MAX = 7;

const TRAIL_SAMPLE_MS = 130;
const TRAIL_MAX = 3;
const TRAIL_FADE_MS = 400;
const TRAIL_STEP_ALPHA = 0.55; // per trail segment

const CORE_WIDTH_MIN_PX = 2;
const CORE_WIDTH_MAX_PX = 3;
const HALO_BLUR_PX = 6;

const REF_DIM = 640;
const SCALE_MIN = 0.6;
const SCALE_MAX = 1.6;

const STATIC_FREEZE_FRAC = 0.55; // reduced-motion: 55% climb height

interface Tokens {
  fg: string;
  muted: string;
}

function readTokens(): Tokens | null {
  if (typeof document === "undefined") return null;
  const cs = getComputedStyle(document.documentElement);
  const fg = cs.getPropertyValue("--foreground").trim();
  const muted = cs.getPropertyValue("--ns-muted").trim();
  if (!fg || !muted) return null; // not loaded yet — no paint before this
  return { fg, muted };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** deterministic hashed pseudo-random in [-1, 1], keyed on rank + time-bucket + vertex —
 * gives a discretely-resampled jitter with no persisted per-frame state. */
function hashJitter(rank: number, bucket: number, vertex: number): number {
  let h = Math.imul((rank + 1) * 0x9e3779b9, 0x85ebca6b);
  h ^= Math.imul((bucket + vertex * 7349) ^ h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

function easeInQuad(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c;
}

interface Geo {
  W: number;
  H: number;
  minDim: number;
  cx: number;
  scale: number;
  baseGapHalf: number;
  maxClimb: number;
}

function computeGeo(W: number, H: number): Geo {
  const minDim = Math.min(W, H);
  const scale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, minDim / REF_DIM));
  return {
    W,
    H,
    minDim,
    cx: W / 2,
    scale,
    baseGapHalf: (minDim * BASE_GAP_FRAC) / 2,
    maxClimb: H * CLIMB_MAX_FRAC,
  };
}

/** x-offset from center at a given climb height (distance risen from the base) */
function railOffsetAt(geo: Geo, ch: number): number {
  return geo.baseGapHalf + ch * HALF_ANGLE_TAN;
}

interface ArcState {
  phase: "climbing" | "dark";
  phaseStartMs: number;
  phaseDurMs: number;
  vertCount: number;
  rank: number; // varies the jitter hash between successive arcs
  trail: { ch: number; capturedAt: number }[];
  lastTrailSampleMs: number;
}

function randPeriod(rand: () => number) {
  return PERIOD_MIN_MS + rand() * (PERIOD_MAX_MS - PERIOD_MIN_MS);
}
function randDark(rand: () => number) {
  return DARK_MIN_MS + rand() * (DARK_MAX_MS - DARK_MIN_MS);
}
function randVerts(rand: () => number) {
  return VERTS_MIN + Math.floor(rand() * (VERTS_MAX - VERTS_MIN + 1));
}

function buildArcState(rand: () => number): ArcState {
  return {
    phase: "climbing",
    phaseStartMs: 0,
    phaseDurMs: randPeriod(rand) * CLIMB_FRAC_OF_PERIOD,
    vertCount: randVerts(rand),
    rank: 0,
    trail: [],
    lastTrailSampleMs: -Infinity,
  };
}

/** walks the arc's climbing/dark phase machine forward to nowMs, catching up
 * through as many completed phases as have elapsed — a fresh climb duration
 * or dark gap is only ever rolled at the instant the arc's OWN phase ends. */
function advanceArc(state: ArcState, nowMs: number, rand: () => number) {
  for (let guard = 0; guard < 64; guard++) {
    const phaseEndMs = state.phaseStartMs + state.phaseDurMs;
    if (nowMs < phaseEndMs) return;
    if (state.phase === "climbing") {
      state.phase = "dark";
      state.phaseStartMs = phaseEndMs;
      state.phaseDurMs = randDark(rand);
    } else {
      state.phase = "climbing";
      state.phaseStartMs = phaseEndMs;
      state.phaseDurMs = randPeriod(rand) * CLIMB_FRAC_OF_PERIOD;
      state.vertCount = randVerts(rand);
      state.rank += 1;
    }
  }
}

function climbHeightAt(geo: Geo, t: number): number {
  const eased = easeInQuad(t);
  return CLIMB_START_PX * geo.scale + (geo.maxClimb - CLIMB_START_PX * geo.scale) * eased;
}

function drawRails(ctx: CanvasRenderingContext2D, geo: Geo, tokens: Tokens) {
  const topOffset = railOffsetAt(geo, geo.H);
  const baseOffset = geo.baseGapHalf;
  ctx.save();
  ctx.strokeStyle = tokens.muted;
  ctx.lineWidth = 1.25 * geo.scale;
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(geo.cx - baseOffset, geo.H);
  ctx.lineTo(geo.cx - topOffset, 0);
  ctx.moveTo(geo.cx + baseOffset, geo.H);
  ctx.lineTo(geo.cx + topOffset, 0);
  ctx.stroke();
  ctx.restore();
}

function arcVertices(geo: Geo, ch: number, vertCount: number, rank: number, bucket: number, jittering: boolean) {
  const y = geo.H - ch;
  const halfSpan = railOffsetAt(geo, ch);
  const leftX = geo.cx - halfSpan;
  const rightX = geo.cx + halfSpan;
  const jitterMag = (JITTER_MIN_PX + ((rank * 0.61803) % 1) * (JITTER_MAX_PX - JITTER_MIN_PX)) * geo.scale;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < vertCount; i++) {
    const t = i / (vertCount - 1);
    const x = leftX + (rightX - leftX) * t;
    if (!jittering || i === 0 || i === vertCount - 1) {
      pts.push({ x, y });
      continue;
    }
    const taper = Math.sin(Math.PI * t); // pinned at both rail contact points
    const j = hashJitter(rank, bucket, i) * jitterMag * taper;
    pts.push({ x, y: y + j });
  }
  return pts;
}

function drawArcPath(ctx: CanvasRenderingContext2D, geo: Geo, tokens: Tokens, pts: { x: number; y: number }[], alpha: number, withHalo: boolean) {
  const first = pts[0];
  if (!first) return;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = tokens.fg;
  ctx.globalAlpha = alpha;
  if (withHalo) {
    ctx.shadowColor = tokens.fg;
    ctx.shadowBlur = HALO_BLUR_PX * geo.scale;
  }
  ctx.lineWidth = (CORE_WIDTH_MIN_PX + ((geo.scale + 0.37) % 1) * (CORE_WIDTH_MAX_PX - CORE_WIDTH_MIN_PX)) * geo.scale;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p) ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}

export interface ArcLadderClimbProps {
  /** content rendered over the field (headline, section label, etc.) */
  children?: ReactNode;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function ArcLadderClimb({ children, className = "" }: ArcLadderClimbProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seed = 0x4c1b7a;
    const rand = mulberry32(seed ^ 0x2545f4);

    let disposed = false;
    let tokens: Tokens | null = null;
    let dpr = 1;
    let geo: Geo = computeGeo(1, 1);
    let sized = false;
    let visible = true;

    let state: ArcState = buildArcState(rand);

    let startMs = 0;
    let raf = 0;
    let tokenWaitRaf = 0;

    const fitCanvas = () => {
      canvas.width = Math.max(1, Math.round(geo.W * dpr));
      canvas.height = Math.max(1, Math.round(geo.H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = (nowMs: number) => {
      if (!tokens || !sized) return;
      advanceArc(state, nowMs, rand);
      ctx.clearRect(0, 0, geo.W, geo.H);
      drawRails(ctx, geo, tokens);

      const bucket = Math.floor(nowMs / JITTER_BUCKET_MS);
      const climbing = state.phase === "climbing";
      const elapsed = nowMs - state.phaseStartMs;
      const liveCh = climbing ? climbHeightAt(geo, elapsed / state.phaseDurMs) : geo.maxClimb;

      if (climbing && nowMs - state.lastTrailSampleMs >= TRAIL_SAMPLE_MS) {
        state.trail.push({ ch: liveCh, capturedAt: nowMs });
        if (state.trail.length > TRAIL_MAX) state.trail.shift();
        state.lastTrailSampleMs = nowMs;
      }

      // afterglow trail: older samples first, so the live arc paints last (on top)
      for (let i = 0; i < state.trail.length; i++) {
        const s = state.trail[i];
        if (!s) continue;
        const age = nowMs - s.capturedAt;
        if (age >= TRAIL_FADE_MS || age < 0) continue;
        const ageAlpha = 1 - age / TRAIL_FADE_MS;
        const rankAlpha = Math.pow(TRAIL_STEP_ALPHA, state.trail.length - i);
        const pts = arcVertices(geo, s.ch, state.vertCount, state.rank, bucket, true);
        drawArcPath(ctx, geo, tokens, pts, ageAlpha * rankAlpha * 0.9, false);
      }

      if (climbing) {
        const pts = arcVertices(geo, liveCh, state.vertCount, state.rank, bucket, true);
        drawArcPath(ctx, geo, tokens, pts, 0.95, true);
      }
    };

    const resizeAll = () => {
      if (!tokens) return;
      const rect = root.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      geo = computeGeo(rect.width, rect.height);
      fitCanvas();
      sized = true;
    };

    const loop = (nowRaf: number) => {
      if (disposed) return;
      if (!visible) {
        raf = 0; // IntersectionObserver re-arms this on re-entering view
        return;
      }
      raf = requestAnimationFrame(loop);
      if (!sized || !tokens) return;
      if (startMs === 0) startMs = nowRaf;
      render(nowRaf - startMs);
    };

    const buildReducedFrame = () => {
      if (!tokens || !sized) return;
      ctx.clearRect(0, 0, geo.W, geo.H);
      drawRails(ctx, geo, tokens);
      const ch = geo.maxClimb * STATIC_FREEZE_FRAC;
      const vertCount = VERTS_MIN + Math.floor((VERTS_MAX - VERTS_MIN) / 2);
      // static afterglow: two fixed steps below the frozen arc, no timers —
      // jitter uses a fixed bucket (0) so the shape is deterministic and
      // never redrawn, but still visibly jagged rather than a flat line.
      const ghost1 = arcVertices(geo, ch * 0.86, vertCount, 1, 0, true);
      const ghost2 = arcVertices(geo, ch * 0.7, vertCount, 2, 0, true);
      drawArcPath(ctx, geo, tokens, ghost2, 0.16, false);
      drawArcPath(ctx, geo, tokens, ghost1, 0.32, false);
      const live = arcVertices(geo, ch, vertCount, 0, 0, true);
      drawArcPath(ctx, geo, tokens, live, 0.95, true);
    };

    let started = false;
    const kick = () => {
      if (started || disposed || !tokens || !sized) return;
      started = true;
      if (reduced) {
        buildReducedFrame();
        return; // no rAF loop, no timers, no observers driving motion
      }
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (disposed) return;
      tokens = readTokens();
      if (!tokens) {
        tokenWaitRaf = requestAnimationFrame(start);
        return;
      }
      resizeAll();
      kick();
    };

    const ro = new ResizeObserver(() => {
      if (!tokens) return;
      resizeAll();
      if (reduced) buildReducedFrame();
      kick();
    });
    ro.observe(root);

    const mo = new MutationObserver(() => {
      tokens = readTokens();
      if (tokens) {
        resizeAll();
        if (reduced) buildReducedFrame();
        kick();
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver((entries) => {
      const wasVisible = visible;
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !wasVisible && !reduced && tokens && !raf) {
        tokens = readTokens() ?? tokens; // pick up any theme flip that happened while hidden
        resizeAll();
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tokenWaitRaf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section ref={rootRef} className={`relative isolate min-h-[420px] w-full overflow-hidden bg-background ${className}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      {children ? (
        <div className="relative z-10 mx-auto flex h-full min-h-[420px] w-full max-w-5xl flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          {children}
        </div>
      ) : null}
    </section>
  );
}
