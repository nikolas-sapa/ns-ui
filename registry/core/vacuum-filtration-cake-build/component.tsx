"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// VacuumFiltrationCakeBuild — a card-scale processing/progress indicator
// modelled on Büchner-funnel vacuum filtration: liquid drips through filter
// paper into a receiving flask while a solids "cake" builds on the paper's
// surface. Under constant applied pressure, filtration rate decays as the
// cake thickens (Darcy's law: flow rate is inversely proportional to cake
// resistance, which grows with cake height) — visible here as the drip
// cadence steadily stretching out while the cake visibly thickens.
//
// Cake height follows the constant-pressure Darcy relation h(t) = sqrt(2kt),
// tuned so the cake grows from 0 to 38% of the filter-paper radius over a
// 14s fill phase. Drip interval is sampled continuously from an inverse
// relationship to total resistance (paper's own baseline resistance h0 plus
// the growing cake h(t)): interval(t) = 0.6s * (h0 + h(t)) / h0, which
// starts at 0.6s (t0, bare paper) and stretches to 2.4s by t=14s (thick
// cake) — a 4x slowdown, not a fixed schedule. At 14s the vacuum releases
// (a brief 0.4s bubble-burst at the cake surface), the cake and flask
// contents fade out over 1.5s, and the cycle restarts empty. Full loop is
// ~15.9s, unbounded.
//
// One canvas, cleared and fully redrawn every frame (cheap: a handful of
// strokes, a clipped fill, one gradient dome). The funnel/flask glass
// outline is drawn every frame at a fixed low alpha from --border (a
// non-load-bearing rim, never the fill or stroke carrying the cake or
// liquid); the cake dome and flask liquid are drawn through a shared
// contentAlpha that only drops during the end-of-cycle fade, so the glass
// itself never fades. The cake is a filled top-half ellipse (a true
// semicircular profile when height equals radius) with a radial gradient
// from --foreground at its apex to --ns-muted at its rim. The flask liquid
// is filled by clipping to the flask's interior polygon and filling a rect
// from the current liquid-surface y down — exact against the tapered
// silhouette with no separate area math. Each drop is animated as a real
// departure-to-splash arc (constant ~260ms fall, always far shorter than
// the shortest 0.6s interval) rather than a blink, so the slowing cadence
// reads from the GAP between arcs, not from the arcs themselves.
// ---------------------------------------------------------------------------

const FILL_S = 14; // constant-pressure fill phase, seconds
const BURST_MS = 400; // vacuum-release bubble burst
const FADE_MS = 1500; // cake + flask contents fade to empty
const LOOP_MS = FILL_S * 1000 + BURST_MS + FADE_MS; // ~15.9s, unbounded loop

const HMAX = 0.38; // cake height at t=14s, fraction of paper radius
const K = (HMAX * HMAX) / (2 * FILL_S); // h(t) = sqrt(2*K*t), h(14) = HMAX
const H0 = HMAX / 3; // paper's own baseline resistance (interval(14)/interval(0) = 4)
const INTERVAL_T0 = 0.6; // seconds per drop, bare paper
const FALL_MS = 260; // constant drop fall duration, well under the 0.6s min interval

const REF_DIM = 260; // reference min-dimension for the 5px-per-drop spec number
const DROP_STEP_PX_REF = 5;

const STATIC_FRACTION = 0.6; // reduced-motion freeze: 60% through the fill cycle

interface Tokens {
  fg: string;
  border: string;
  muted: string;
}

function readTokens(): Tokens | null {
  if (typeof document === "undefined") return null;
  const cs = getComputedStyle(document.documentElement);
  const fg = cs.getPropertyValue("--foreground").trim();
  const border = cs.getPropertyValue("--border").trim();
  const muted = cs.getPropertyValue("--ns-muted").trim();
  if (!fg || !border || !muted) return null; // not loaded yet — no paint before this
  return { fg, border, muted };
}

/** cake height, 0..HMAX fraction of paper radius, for fill-phase elapsed seconds (0..FILL_S) */
function cakeFrac(tSec: number): number {
  const t = Math.max(0, Math.min(FILL_S, tSec));
  return Math.min(HMAX, Math.sqrt(2 * K * t));
}

/** seconds until the next drop, sampled continuously from the current cake height */
function dripInterval(tSec: number): number {
  const h = cakeFrac(tSec);
  return INTERVAL_T0 * ((H0 + h) / H0);
}

interface Geo {
  W: number;
  H: number;
  minDim: number;
  cx: number;
  funnelTopY: number;
  funnelTopHalfW: number;
  paperY: number;
  paperRadius: number;
  stemTipY: number;
  neckTopY: number;
  neckHalfW: number;
  neckBottomY: number;
  shoulderY: number;
  bodyHalfW: number;
  flaskBottomY: number;
  dropStepPx: number;
}

function computeGeo(W: number, H: number): Geo {
  const minDim = Math.min(W, H);
  const cx = W / 2;
  const funnelTopY = H * 0.07;
  const funnelTopHalfW = minDim * 0.36;
  const paperY = H * 0.29;
  const paperRadius = minDim * 0.22;
  const neckTopY = paperY;
  const neckHalfW = minDim * 0.05;
  const stemTipY = H * 0.4;
  const neckBottomY = H * 0.46;
  const shoulderY = H * 0.58;
  const bodyHalfW = minDim * 0.3;
  const flaskBottomY = H * 0.9;
  const dropStepPx = DROP_STEP_PX_REF * (minDim / REF_DIM);
  return {
    W,
    H,
    minDim,
    cx,
    funnelTopY,
    funnelTopHalfW,
    paperY,
    paperRadius,
    stemTipY,
    neckTopY,
    neckHalfW,
    neckBottomY,
    shoulderY,
    bodyHalfW,
    flaskBottomY,
    dropStepPx,
  };
}

/** builds the closed flask-interior polygon path (also used as the liquid clip region) */
function flaskPath(ctx: CanvasRenderingContext2D, g: Geo) {
  ctx.beginPath();
  ctx.moveTo(g.cx - g.neckHalfW, g.neckTopY);
  ctx.lineTo(g.cx - g.neckHalfW, g.neckBottomY);
  ctx.lineTo(g.cx - g.bodyHalfW, g.shoulderY);
  ctx.lineTo(g.cx - g.bodyHalfW, g.flaskBottomY);
  ctx.lineTo(g.cx + g.bodyHalfW, g.flaskBottomY);
  ctx.lineTo(g.cx + g.bodyHalfW, g.shoulderY);
  ctx.lineTo(g.cx + g.neckHalfW, g.neckBottomY);
  ctx.lineTo(g.cx + g.neckHalfW, g.neckTopY);
  ctx.closePath();
}

function drawGlass(ctx: CanvasRenderingContext2D, g: Geo, tokens: Tokens) {
  ctx.save();
  ctx.strokeStyle = tokens.border;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1;

  // funnel body: two sides from the wide top rim down to the paper line
  ctx.beginPath();
  ctx.moveTo(g.cx - g.funnelTopHalfW, g.funnelTopY);
  ctx.lineTo(g.cx - g.paperRadius, g.paperY);
  ctx.moveTo(g.cx + g.funnelTopHalfW, g.funnelTopY);
  ctx.lineTo(g.cx + g.paperRadius, g.paperY);
  ctx.moveTo(g.cx - g.funnelTopHalfW, g.funnelTopY);
  ctx.lineTo(g.cx + g.funnelTopHalfW, g.funnelTopY);
  ctx.stroke();

  // filter paper: the load-bearing separator between funnel and cake, drawn
  // slightly bolder than the rest of the glass since the cake reads off it
  ctx.beginPath();
  ctx.moveTo(g.cx - g.paperRadius, g.paperY);
  ctx.lineTo(g.cx + g.paperRadius, g.paperY);
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 0.7;

  // stem: narrow tube from the paper's underside down to its visible drip tip
  ctx.beginPath();
  ctx.moveTo(g.cx - g.neckHalfW, g.paperY);
  ctx.lineTo(g.cx - g.neckHalfW, g.stemTipY);
  ctx.moveTo(g.cx + g.neckHalfW, g.paperY);
  ctx.lineTo(g.cx + g.neckHalfW, g.stemTipY);
  ctx.stroke();

  // flask silhouette
  flaskPath(ctx, g);
  ctx.stroke();

  ctx.restore();
}

interface Drop {
  startMs: number;
  fromY: number;
  toY: number;
}

interface SimState {
  drops: Drop[];
  liquidLevelPx: number;
  nextDropAtMs: number;
  lastLandY: number | null;
  lastLandMs: number;
}

function freshSim(): SimState {
  return { drops: [], liquidLevelPx: 0, nextDropAtMs: 0, lastLandY: null, lastLandMs: -Infinity };
}

/** advances the drip/fill simulation deterministically, spawning/landing drops up to nowMs */
function stepSim(sim: SimState, nowMs: number, g: Geo) {
  // spawn new drops whose scheduled departure falls within (prevMs, nowMs]
  while (sim.nextDropAtMs <= nowMs && sim.nextDropAtMs < FILL_S * 1000) {
    const liquidSurfaceY = g.flaskBottomY - sim.liquidLevelPx;
    sim.drops.push({ startMs: sim.nextDropAtMs, fromY: g.stemTipY, toY: liquidSurfaceY });
    const tSec = sim.nextDropAtMs / 1000;
    sim.nextDropAtMs += dripInterval(tSec) * 1000;
  }
  // land any drop whose fall has completed
  sim.drops = sim.drops.filter((d) => {
    if (nowMs - d.startMs >= FALL_MS) {
      sim.liquidLevelPx += g.dropStepPx;
      sim.lastLandY = d.toY;
      sim.lastLandMs = nowMs;
      return false;
    }
    return true;
  });
}

function drawCake(ctx: CanvasRenderingContext2D, g: Geo, heightPx: number, tokens: Tokens, alpha: number) {
  if (heightPx <= 0.5) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.ellipse(g.cx, g.paperY, g.paperRadius * 0.98, heightPx, 0, Math.PI, 2 * Math.PI);
  ctx.lineTo(g.cx + g.paperRadius * 0.98, g.paperY);
  ctx.closePath();
  const grad = ctx.createRadialGradient(
    g.cx,
    g.paperY - heightPx,
    0,
    g.cx,
    g.paperY,
    Math.max(g.paperRadius, heightPx),
  );
  grad.addColorStop(0, tokens.fg);
  grad.addColorStop(1, tokens.muted);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

function drawLiquid(ctx: CanvasRenderingContext2D, g: Geo, liquidLevelPx: number, tokens: Tokens, alpha: number) {
  if (liquidLevelPx <= 0.5) return;
  ctx.save();
  ctx.globalAlpha = alpha * 0.55;
  flaskPath(ctx, g);
  ctx.clip();
  const surfaceY = g.flaskBottomY - liquidLevelPx;
  ctx.fillStyle = tokens.fg;
  ctx.fillRect(g.cx - g.bodyHalfW - 2, surfaceY, g.bodyHalfW * 2 + 4, g.flaskBottomY - surfaceY + 2);
  ctx.restore();
}

function drawDrop(ctx: CanvasRenderingContext2D, g: Geo, drop: Drop, nowMs: number, tokens: Tokens, alpha: number) {
  const p = Math.max(0, Math.min(1, (nowMs - drop.startMs) / FALL_MS));
  const eased = p * p; // accelerating, gravity-like
  const y = drop.fromY + (drop.toY - drop.fromY) * eased;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = tokens.fg;
  ctx.beginPath();
  ctx.arc(g.cx, y, Math.max(1.5, g.minDim * 0.012), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSplash(ctx: CanvasRenderingContext2D, g: Geo, y: number, ageMs: number, tokens: Tokens, alpha: number) {
  const p = Math.max(0, Math.min(1, ageMs / 180));
  if (p >= 1) return;
  ctx.save();
  ctx.globalAlpha = alpha * (1 - p) * 0.6;
  ctx.strokeStyle = tokens.fg;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(g.cx, y, g.minDim * 0.03 * (0.3 + p), g.minDim * 0.01 * (0.3 + p), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBurst(ctx: CanvasRenderingContext2D, g: Geo, ageMs: number, tokens: Tokens) {
  const p = Math.max(0, Math.min(1, ageMs / BURST_MS));
  if (p >= 1) return;
  const count = 6;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + i * 0.4;
    const dist = p * g.paperRadius * 0.7;
    const x = g.cx + Math.cos(angle) * dist;
    const y = g.paperY - g.paperRadius * HMAX * 0.4 + Math.sin(angle) * dist * 0.5;
    ctx.globalAlpha = (1 - p) * 0.7;
    ctx.fillStyle = tokens.fg;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, g.minDim * 0.012 * (1 - p * 0.5)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** deterministically simulates a full fill phase up to tSec, for the reduced-motion freeze frame */
function buildStaticFrame(g: Geo, tSec: number): { sim: SimState; nowMs: number } {
  const sim = freshSim();
  const nowMs = tSec * 1000;
  stepSim(sim, nowMs, g);
  return { sim, nowMs };
}

export interface VacuumFiltrationCakeBuildProps {
  /** small mono label above the chart, e.g. the process this indicator tracks */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function VacuumFiltrationCakeBuild({
  label = "PROCESSING",
  className = "",
}: VacuumFiltrationCakeBuildProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const chartWrap = chartWrapRef.current;
    const canvas = canvasRef.current;
    if (!chartWrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let tokens: Tokens | null = null;
    let dpr = 1;
    let g: Geo = computeGeo(1, 1);
    let sized = false;
    let visible = true;

    let sim = freshSim();
    let cycleStartMs = 0;
    let raf = 0;
    let tokenWaitRaf = 0;

    const fitCanvas = () => {
      canvas.width = Math.max(1, Math.round(g.W * dpr));
      canvas.height = Math.max(1, Math.round(g.H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = (nowMs: number) => {
      if (!tokens || !sized) return;
      ctx.clearRect(0, 0, g.W, g.H);
      drawGlass(ctx, g, tokens);

      let contentAlpha = 1;
      let heightPx: number;
      let liquidLevelPx: number;

      if (nowMs < FILL_S * 1000) {
        heightPx = cakeFrac(nowMs / 1000) * g.paperRadius;
        liquidLevelPx = sim.liquidLevelPx;
        for (const d of sim.drops) drawDrop(ctx, g, d, nowMs, tokens, contentAlpha);
      } else if (nowMs < FILL_S * 1000 + BURST_MS) {
        heightPx = HMAX * g.paperRadius;
        liquidLevelPx = sim.liquidLevelPx;
        drawBurst(ctx, g, nowMs - FILL_S * 1000, tokens);
      } else {
        heightPx = HMAX * g.paperRadius;
        liquidLevelPx = sim.liquidLevelPx;
        const fadeAge = nowMs - FILL_S * 1000 - BURST_MS;
        contentAlpha = Math.max(0, 1 - fadeAge / FADE_MS);
      }

      drawCake(ctx, g, heightPx, tokens, contentAlpha);
      drawLiquid(ctx, g, liquidLevelPx, tokens, contentAlpha);
      if (sim.lastLandY != null) {
        drawSplash(ctx, g, sim.lastLandY, nowMs - sim.lastLandMs, tokens, contentAlpha);
      }
    };

    const resizeAll = () => {
      if (!tokens) return;
      const rect = chartWrap.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      g = computeGeo(rect.width, rect.height);
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
      if (cycleStartMs === 0) cycleStartMs = nowRaf;
      let elapsed = nowRaf - cycleStartMs;
      if (elapsed >= LOOP_MS) {
        sim = freshSim();
        cycleStartMs = nowRaf;
        elapsed = 0;
      }
      if (elapsed < FILL_S * 1000) {
        stepSim(sim, elapsed, g);
      }
      render(elapsed);
    };

    const buildReducedFrame = () => {
      const t = FILL_S * STATIC_FRACTION; // 8.4s — cake buildup, flask level, an in-flight drop
      const { sim: staticSim, nowMs } = buildStaticFrame(g, t);
      // pin one drop mid-fall so the frozen frame shows a departure arc, not just endpoints
      const liquidSurfaceY = g.flaskBottomY - staticSim.liquidLevelPx;
      staticSim.drops = [{ startMs: nowMs - FALL_MS * 0.5, fromY: g.stemTipY, toY: liquidSurfaceY }];
      staticSim.lastLandY = null;
      sim = staticSim;
      render(nowMs);
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
    ro.observe(chartWrap);

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
        // restart the cycle rather than resuming mid-flight — an arbitrarily
        // long time off-screen must not resume a stale, half-thick cake
        sim = freshSim();
        cycleStartMs = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(chartWrap);

    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tokenWaitRaf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-surface p-4 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="truncate font-mono text-[11px] tracking-widest text-ns-muted">{label}</p>
        <p className="shrink-0 font-mono text-[10px] tracking-widest text-ns-muted">VACUUM</p>
      </div>
      <div ref={chartWrapRef} className="relative w-full" style={{ aspectRatio: "3 / 4" }}>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}
