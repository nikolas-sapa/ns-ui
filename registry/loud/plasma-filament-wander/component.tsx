"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// PlasmaGlobe — a full-bleed hero background modelled on a plasma globe: a
// central electrode inside a low-pressure gas sphere ionizes discrete
// filaments that reach from the center to the inner glass, constantly
// wandering, retracting and reattaching elsewhere in a chaotic, ever-
// rerouting pattern. Each filament runs its OWN independent lifecycle —
// attached-and-jittering, or retracting-and-regrowing to a new target angle
// — on its own randomized 1.2-2.6s cadence, staggered so the globe always
// shows some motion while any single filament's own event stays trackable.
//
// A filament never teleports: advanceFilament() walks a filament's phase
// machine forward through however many completed cycles fall between the
// last frame and now (needed both for a background tab catching up and for
// jumping straight to the reduced-motion freeze frame), and a reroute is
// always the same 350ms eased retract-then-regrow, never a snap.
//
// Pointer proximity biases WHERE a filament reroutes to, never WHEN — the
// bias is only consulted at a filament's own natural reroute moment, and
// only ~40% of filaments take it, so the globe never reads as a spotlight
// chasing the cursor. Filament jitter is resampled from a hashed function of
// (filament, 100ms time-bucket) rather than persisted per-frame state, so a
// ~10Hz "plasma noise" cadence falls out for free without an extra timer.
// ---------------------------------------------------------------------------

const LIFETIME_MIN_MS = 1200;
const LIFETIME_MAX_MS = 2600;
const REROUTE_MS = 350; // eased retract-then-regrow transition

const JITTER_MIN_PX = 4;
const JITTER_MAX_PX = 8;
const JITTER_BUCKET_MS = 100; // ~10Hz resample, decoupled from the paint loop
const JITTER_SEGMENTS = 7; // interior points along a filament's polyline

const POINTER_PROXIMITY_FRAC = 0.2; // of the container's smaller dimension, measured from the ring
const POINTER_BIAS_MAX_FRAC = 0.4; // up to 40% of filaments take the bias at their own reroute
const POINTER_BIAS_SPREAD_RAD = 0.35; // randomized scatter around the pointer's angle

const CORE_WIDTH_MIN_PX = 1.5;
const CORE_WIDTH_MAX_PX = 2.5;
const HALO_BLUR_PX = 4;

const BASELINE_COUNT = 11;
const MIN_COUNT = 6;
const CARD_SCALE_REF = 520; // below this minDim, filament count thins to stay legible

const REF_DIM = 520; // width/jitter/radius scale reference
const SCALE_MIN = 0.55;
const SCALE_MAX = 1.6;

const RING_RADIUS_FRAC = 0.36; // of minDim
const RING_ALPHA = 0.35;

const STATIC_FREEZE_MS = 1800; // reduced-motion freeze: varied lengths, mid-cycle, asymmetric

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

/** deterministic hashed pseudo-random in [-1, 1], keyed on filament + time-bucket + segment —
 * gives a discretely-resampled jitter with no persisted per-frame state. */
function hashJitter(filamentIdx: number, bucket: number, segment: number): number {
  let h = Math.imul(filamentIdx ^ 0x9e3779b9, 0x85ebca6b);
  h ^= Math.imul((bucket + segment * 7349) ^ h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

function easeInOutCubic(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

interface Geo {
  W: number;
  H: number;
  minDim: number;
  cx: number;
  cy: number;
  ringRadius: number;
  scale: number;
  count: number;
}

function computeGeo(W: number, H: number, baselineCount: number): Geo {
  const minDim = Math.min(W, H);
  const scale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, minDim / REF_DIM));
  const count = Math.max(MIN_COUNT, Math.min(baselineCount, Math.round(baselineCount * Math.min(1, minDim / CARD_SCALE_REF))));
  return {
    W,
    H,
    minDim,
    cx: W / 2,
    cy: H / 2,
    ringRadius: minDim * RING_RADIUS_FRAC,
    scale,
    count,
  };
}

interface Filament {
  phase: "attached" | "rerouting";
  angle: number; // current attached angle, or the retracting-from angle
  oldAngle: number;
  newAngle: number;
  phaseEndMs: number; // attached: reroute trigger time
  rerouteStartMs: number;
  rerouteEndMs: number;
  jitterMag: number; // 4-8px, fixed per filament
  widthFrac: number; // 0..1, fixed per filament
}

function buildFilaments(count: number, seed: number): Filament[] {
  const rand = mulberry32(seed);
  const filaments: Filament[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.3;
    filaments.push({
      phase: "attached",
      angle,
      oldAngle: angle,
      newAngle: angle,
      // staggered initial reroute so 11 filaments never all move together
      phaseEndMs: rand() * LIFETIME_MAX_MS,
      rerouteStartMs: 0,
      rerouteEndMs: 0,
      jitterMag: JITTER_MIN_PX + rand() * (JITTER_MAX_PX - JITTER_MIN_PX),
      widthFrac: rand(),
    });
  }
  return filaments;
}

/** walks one filament's phase machine forward to nowMs, catching up through
 * as many completed attached/rerouting cycles as have elapsed — a reroute
 * target is only ever chosen at the instant a filament's OWN cycle ends. */
function advanceFilament(
  f: Filament,
  nowMs: number,
  rand: () => number,
  pointerActive: boolean,
  pointerAngle: number,
) {
  for (let guard = 0; guard < 64; guard++) {
    if (f.phase === "attached") {
      if (nowMs < f.phaseEndMs) return;
      f.phase = "rerouting";
      f.oldAngle = f.angle;
      f.rerouteStartMs = f.phaseEndMs;
      f.rerouteEndMs = f.rerouteStartMs + REROUTE_MS;
      const biased = pointerActive && rand() < POINTER_BIAS_MAX_FRAC;
      f.newAngle = biased
        ? pointerAngle + (rand() - 0.5) * 2 * POINTER_BIAS_SPREAD_RAD
        : rand() * Math.PI * 2;
    } else {
      if (nowMs < f.rerouteEndMs) return;
      f.phase = "attached";
      f.angle = f.newAngle;
      const lifetime = LIFETIME_MIN_MS + rand() * (LIFETIME_MAX_MS - LIFETIME_MIN_MS);
      f.phaseEndMs = f.rerouteEndMs + lifetime;
    }
  }
}

function drawRing(ctx: CanvasRenderingContext2D, geo: Geo, tokens: Tokens) {
  ctx.save();
  ctx.globalAlpha = RING_ALPHA;
  ctx.strokeStyle = tokens.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(geo.cx, geo.cy, geo.ringRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawFilament(ctx: CanvasRenderingContext2D, geo: Geo, tokens: Tokens, f: Filament, idx: number, nowMs: number) {
  let angle: number;
  let length: number;
  let jittering: boolean;

  if (f.phase === "attached") {
    angle = f.angle;
    length = geo.ringRadius;
    jittering = true;
  } else {
    const p = Math.max(0, Math.min(1, (nowMs - f.rerouteStartMs) / REROUTE_MS));
    if (p < 0.5) {
      const local = p / 0.5;
      angle = f.oldAngle;
      length = geo.ringRadius * (1 - easeInOutCubic(local));
    } else {
      const local = (p - 0.5) / 0.5;
      angle = f.newAngle;
      length = geo.ringRadius * easeInOutCubic(local);
    }
    jittering = false;
  }

  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const perpX = -dirY;
  const perpY = dirX;
  const bucket = Math.floor(nowMs / JITTER_BUCKET_MS);
  const jitterMag = f.jitterMag * geo.scale;

  const pts: { x: number; y: number }[] = [];
  for (let s = 0; s <= JITTER_SEGMENTS; s++) {
    const t = s / JITTER_SEGMENTS;
    const baseX = geo.cx + dirX * length * t;
    const baseY = geo.cy + dirY * length * t;
    if (s === 0 || s === JITTER_SEGMENTS || !jittering) {
      pts.push({ x: baseX, y: baseY });
      continue;
    }
    const taper = Math.sin(Math.PI * t); // pinned at center and tip, freest mid-span
    const j = hashJitter(idx, bucket, s) * jitterMag * taper;
    pts.push({ x: baseX + perpX * j, y: baseY + perpY * j });
  }

  const coreWidth = (CORE_WIDTH_MIN_PX + f.widthFrac * (CORE_WIDTH_MAX_PX - CORE_WIDTH_MIN_PX)) * geo.scale;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = tokens.fg;
  ctx.shadowColor = tokens.fg;
  ctx.shadowBlur = HALO_BLUR_PX * geo.scale;
  ctx.lineWidth = coreWidth;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  const first = pts[0];
  if (!first) {
    ctx.restore();
    return;
  }
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p) ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}

export interface PlasmaFilamentWanderProps {
  /** baseline filament count at full-bleed scale; thins automatically at card scale */
  filamentCount?: number;
  /** content rendered over the field (headline, CTA, etc.) */
  children?: ReactNode;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function PlasmaFilamentWander({ filamentCount = BASELINE_COUNT, children, className = "" }: PlasmaFilamentWanderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seed = 0x91a3f0;
    const rand = mulberry32(seed ^ 0x2545f4);

    let disposed = false;
    let tokens: Tokens | null = null;
    let dpr = 1;
    let geo: Geo = computeGeo(1, 1, filamentCount);
    let sized = false;
    let visible = true;
    let filaments: Filament[] = buildFilaments(geo.count, seed);

    let startMs = 0;
    let raf = 0;
    let tokenWaitRaf = 0;

    let pointerActive = false;
    let pointerAngle = 0;

    const fitCanvas = () => {
      canvas.width = Math.max(1, Math.round(geo.W * dpr));
      canvas.height = Math.max(1, Math.round(geo.H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = (nowMs: number) => {
      if (!tokens || !sized) return;
      for (let i = 0; i < filaments.length; i++) {
        const f = filaments[i];
        if (f) advanceFilament(f, nowMs, rand, pointerActive, pointerAngle);
      }
      ctx.clearRect(0, 0, geo.W, geo.H);
      drawRing(ctx, geo, tokens);
      for (let i = 0; i < filaments.length; i++) {
        const f = filaments[i];
        if (f) drawFilament(ctx, geo, tokens, f, i, nowMs);
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
      const nextGeo = computeGeo(rect.width, rect.height, filamentCount);
      if (nextGeo.count !== geo.count) filaments = buildFilaments(nextGeo.count, seed);
      geo = nextGeo;
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
      render(STATIC_FREEZE_MS);
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

    const updatePointerFromClient = (clientX: number, clientY: number) => {
      const rect = root.getBoundingClientRect();
      const x = clientX - rect.left - geo.cx;
      const y = clientY - rect.top - geo.cy;
      const dist = Math.hypot(x, y);
      pointerAngle = Math.atan2(y, x);
      pointerActive = Math.abs(dist - geo.ringRadius) < POINTER_PROXIMITY_FRAC * geo.minDim;
    };

    const onPointerMove = (e: PointerEvent) => updatePointerFromClient(e.clientX, e.clientY);
    const onPointerLeave = () => {
      pointerActive = false;
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

    if (!reduced) {
      root.addEventListener("pointermove", onPointerMove);
      root.addEventListener("pointerleave", onPointerLeave);
    }

    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tokenWaitRaf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filamentCount]);

  return (
    <section ref={rootRef} className={`relative isolate min-h-screen w-full overflow-hidden bg-background ${className}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      {children ? (
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-start justify-center gap-4 px-6 py-24">
          {children}
        </div>
      ) : null}
    </section>
  );
}
