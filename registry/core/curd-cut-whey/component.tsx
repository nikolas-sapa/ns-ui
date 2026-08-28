"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// CurdCutWhey — a card-scale batch-processing status indicator modelled on
// cheesemaking curd cutting and syneresis. A solid coagulated mass is cut
// into a grid of cubes with a curd knife (two perpendicular line-wipes);
// once cut, each cube independently shrinks at its own slightly jittered
// rate as syneresis expels whey into the widening gaps between cubes, the
// batch is jostled by a periodic stir, and after the shrink settles the
// cubes recombine into a fresh solid mass and the cycle repeats.
//
// Timeline (one 30s loop, unbounded):
//   0    - 1000ms   CUT      two 500ms perpendicular knife-line wipes
//   1000 - 26000ms  SHRINK   size(t) = size0 * exp(-k t), mean k=0.12/s,
//                             ±15% per-cube jitter, floored at 55% of size0;
//                             a stir jostle (±4px, 300ms spring) fires every
//                             6s of shrink-phase time
//   26000- 29000ms  HOLD     settled at floor size, whey pooled at its peak
//   29000- 30000ms  RECOMBINE cube sizes and whey wash ease back to a solid
//                             mass, then a fresh cut begins
//
// Grid count derives from the container's SMALLER dimension:
// gridN = clamp(round(minDim / 90), 4, 8). Cubes fill in a --foreground-
// derived low-alpha wash; the whey pooling in the gaps between cubes fills
// in --ns-muted, ramped 0 -> a theme-aware peak alpha over the 25s shrink
// (ease-out-quad). The peak is measured, not guessed: a 1x1 offscreen probe
// canvas rasterises --ns-muted and --background and compares luminance —
// low contrast (typical of light themes, where --ns-muted sits close to
// --background) raises the peak alpha so the whey never disappears.
// --border is used only as a stroke: the knife-cut lines and the hairline
// separator between adjacent cubes, never as a gap fill.
// ---------------------------------------------------------------------------

const CUT_MS = 1000; // two 500ms perpendicular wipes
const SHRINK_MS = 25000;
const HOLD_MS = 3000;
const RECOMBINE_MS = 1000;
const LOOP_MS = CUT_MS + SHRINK_MS + HOLD_MS + RECOMBINE_MS; // 30000ms, unbounded

const MEAN_K = 0.12; // /s, mean syneresis exponential rate
const JITTER_FRAC = 0.15; // +-15% per-cube rate jitter
const FLOOR_FRAC = 0.55; // shrink floor, fraction of size0
const KERF_FRAC = 0.04; // knife-line width, fraction of a cell

const STIR_EVERY_MS = 6000; // stir cadence within the shrink phase
const STIR_DUR_MS = 300; // jostle spring settle time
const JOSTLE_PX_REF = 4; // +-4px at REF_DIM
const REF_DIM = 320;

const WHEY_ALPHA_BASE = 0.5; // peak wash alpha, normal-contrast theme
const WHEY_ALPHA_LOW_CONTRAST = 0.72; // peak wash alpha, low-contrast theme
const CONTRAST_THRESHOLD = 0.12; // normalised luminance gap below which "low contrast"

const CUBE_FILL_ALPHA = 0.16;
const CUBE_STROKE_ALPHA = 0.5;
const CUT_LINE_ALPHA = 0.85;

const STATIC_FREEZE_MS = 15000; // reduced-motion freeze: mid-shrink, cadence + gaps both legible

interface Tokens {
  fg: string;
  border: string;
  muted: string;
  background: string;
  wheyAlphaPeak: number;
}

/** rasterises a CSS colour string through a 1x1 canvas to read its actual luminance —
 * used only to compare --ns-muted against --background, never to hardcode a colour. */
function luminanceOf(color: string): number {
  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const pctx = probe.getContext("2d", { willReadFrequently: true } as CanvasRenderingContext2DSettings);
  if (!pctx) return 0;
  pctx.fillStyle = color;
  pctx.fillRect(0, 0, 1, 1);
  const d = pctx.getImageData(0, 0, 1, 1).data;
  return 0.2126 * d[0]! + 0.7152 * d[1]! + 0.0722 * d[2]!;
}

function readTokens(): Tokens | null {
  if (typeof document === "undefined") return null;
  const cs = getComputedStyle(document.documentElement);
  const fg = cs.getPropertyValue("--foreground").trim();
  const border = cs.getPropertyValue("--border").trim();
  const muted = cs.getPropertyValue("--ns-muted").trim();
  const background = cs.getPropertyValue("--background").trim();
  if (!fg || !border || !muted || !background) return null; // not loaded yet — no paint before this
  let wheyAlphaPeak = WHEY_ALPHA_BASE;
  try {
    const contrast = Math.abs(luminanceOf(muted) - luminanceOf(background)) / 255;
    wheyAlphaPeak = contrast < CONTRAST_THRESHOLD ? WHEY_ALPHA_LOW_CONTRAST : WHEY_ALPHA_BASE;
  } catch {
    wheyAlphaPeak = WHEY_ALPHA_BASE;
  }
  return { fg, border, muted, background, wheyAlphaPeak };
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

/** deterministic per-cube-per-stir pseudo-random in [-1, 1], no shared mutable state */
function hashRand(a: number, b: number, salt: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h ^= Math.imul((b + salt) ^ h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

interface Geo {
  W: number;
  H: number;
  minDim: number;
  gridN: number;
  squareX: number;
  squareY: number;
  squareSide: number;
  cellFull: number;
  size0: number;
  jostlePx: number;
}

function computeGeo(W: number, H: number): Geo {
  const minDim = Math.min(W, H);
  const gridN = Math.max(4, Math.min(8, Math.round(minDim / 90)));
  const squareSide = minDim * 0.86;
  const squareX = W / 2 - squareSide / 2;
  const squareY = H / 2 - squareSide / 2;
  const cellFull = squareSide / gridN;
  const size0 = cellFull * (1 - KERF_FRAC);
  const jostlePx = JOSTLE_PX_REF * (minDim / REF_DIM);
  return { W, H, minDim, gridN, squareX, squareY, squareSide, cellFull, size0, jostlePx };
}

interface CubeK {
  k: number; // this cube's own syneresis rate, /s
}

/** builds the per-cube jitter table for one batch (fixed for that batch's whole life) */
function buildCubes(gridN: number, seed: number): CubeK[] {
  const rand = mulberry32(seed);
  const cubes: CubeK[] = [];
  for (let i = 0; i < gridN * gridN; i++) {
    const jitter = 1 + (rand() - 0.5) * 2 * JITTER_FRAC;
    cubes.push({ k: MEAN_K * jitter });
  }
  return cubes;
}

/** current edge length for one cube at shrink-phase elapsed seconds t (0 at the fresh cut) */
function cubeEdge(size0: number, k: number, tSec: number): number {
  const raw = size0 * Math.exp(-k * tSec);
  return Math.max(size0 * FLOOR_FRAC, raw);
}

/** cube-centre jostle offset from the most recent stir event, a 300ms decaying spring */
function jostleOffset(gridN: number, cubeIndex: number, seed: number, shrinkElapsedMs: number, jostlePx: number): { dx: number; dy: number } {
  if (shrinkElapsedMs < STIR_EVERY_MS) return { dx: 0, dy: 0 }; // first stir is at 6s
  const stirIndex = Math.floor(shrinkElapsedMs / STIR_EVERY_MS);
  const sinceStirMs = shrinkElapsedMs - stirIndex * STIR_EVERY_MS;
  if (sinceStirMs >= STIR_DUR_MS) return { dx: 0, dy: 0 };
  const tSec = sinceStirMs / 1000;
  const envelope = Math.exp(-10 * tSec) * Math.cos(2 * Math.PI * 3 * tSec);
  const ax = hashRand(seed + cubeIndex, stirIndex, 17);
  const ay = hashRand(seed + cubeIndex, stirIndex, 401);
  return { dx: ax * jostlePx * envelope, dy: ay * jostlePx * envelope };
}

function easeOutQuad(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return 1 - (1 - c) * (1 - c);
}

function drawWheyWash(ctx: CanvasRenderingContext2D, geo: Geo, tokens: Tokens, alpha: number) {
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = tokens.muted;
  ctx.fillRect(geo.squareX, geo.squareY, geo.squareSide, geo.squareSide);
  ctx.restore();
}

/** draws the settled grid of independently-shrunk, jostled cubes over the whey wash */
function drawCubes(
  ctx: CanvasRenderingContext2D,
  geo: Geo,
  tokens: Tokens,
  cubes: CubeK[],
  shrinkElapsedSec: number,
  shrinkElapsedMs: number,
  seed: number,
  sizeOverrideFrac: number | null,
) {
  ctx.save();
  ctx.fillStyle = tokens.fg;
  ctx.strokeStyle = tokens.border;
  ctx.lineWidth = 1;
  for (let row = 0; row < geo.gridN; row++) {
    for (let col = 0; col < geo.gridN; col++) {
      const idx = row * geo.gridN + col;
      const cube = cubes[idx];
      if (!cube) continue;
      const naturalEdge = cubeEdge(geo.size0, cube.k, shrinkElapsedSec);
      const edge = sizeOverrideFrac != null ? geo.size0 * sizeOverrideFrac : naturalEdge;
      const { dx, dy } = jostleOffset(geo.gridN, idx, seed, shrinkElapsedMs, geo.jostlePx);
      const cx = geo.squareX + (col + 0.5) * geo.cellFull + dx;
      const cy = geo.squareY + (row + 0.5) * geo.cellFull + dy;
      ctx.globalAlpha = CUBE_FILL_ALPHA;
      ctx.fillRect(cx - edge / 2, cy - edge / 2, edge, edge);
      ctx.globalAlpha = CUBE_STROKE_ALPHA;
      ctx.strokeRect(cx - edge / 2, cy - edge / 2, edge, edge);
    }
  }
  ctx.restore();
}

/** two perpendicular knife-line wipes forming the grid over a solid mass */
function drawCutPhase(ctx: CanvasRenderingContext2D, geo: Geo, tokens: Tokens, elapsedMs: number) {
  ctx.save();
  ctx.globalAlpha = CUBE_FILL_ALPHA;
  ctx.fillStyle = tokens.fg;
  ctx.fillRect(geo.squareX, geo.squareY, geo.squareSide, geo.squareSide);

  const hProgress = Math.max(0, Math.min(1, elapsedMs / (CUT_MS / 2)));
  const vProgress = Math.max(0, Math.min(1, (elapsedMs - CUT_MS / 2) / (CUT_MS / 2)));

  ctx.strokeStyle = tokens.border;
  ctx.globalAlpha = CUT_LINE_ALPHA;
  ctx.lineWidth = 1;
  if (hProgress > 0) {
    const w = geo.squareSide * hProgress;
    ctx.beginPath();
    for (let i = 1; i < geo.gridN; i++) {
      const y = geo.squareY + i * geo.cellFull;
      ctx.moveTo(geo.squareX, y);
      ctx.lineTo(geo.squareX + w, y);
    }
    ctx.stroke();
  }
  if (vProgress > 0) {
    const h = geo.squareSide * vProgress;
    ctx.beginPath();
    for (let i = 1; i < geo.gridN; i++) {
      const x = geo.squareX + i * geo.cellFull;
      ctx.moveTo(x, geo.squareY);
      ctx.lineTo(x, geo.squareY + h);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export interface CurdCutWheyProps {
  /** small mono label above the chart, e.g. the batch this indicator tracks */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function CurdCutWhey({ label = "BATCH", className = "" }: CurdCutWheyProps) {
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
    const seed = 0xc5d17e;

    let disposed = false;
    let tokens: Tokens | null = null;
    let dpr = 1;
    let geo: Geo = computeGeo(1, 1);
    let sized = false;
    let visible = true;
    let cubes: CubeK[] = buildCubes(geo.gridN, seed);

    let cycleStartMs = 0;
    let raf = 0;
    let tokenWaitRaf = 0;

    const fitCanvas = () => {
      canvas.width = Math.max(1, Math.round(geo.W * dpr));
      canvas.height = Math.max(1, Math.round(geo.H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = (elapsedMs: number) => {
      if (!tokens || !sized) return;
      ctx.clearRect(0, 0, geo.W, geo.H);

      if (elapsedMs < CUT_MS) {
        drawCutPhase(ctx, geo, tokens, elapsedMs);
        return;
      }

      if (elapsedMs < CUT_MS + SHRINK_MS) {
        const shrinkElapsedMs = elapsedMs - CUT_MS;
        const shrinkElapsedSec = shrinkElapsedMs / 1000;
        const wheyAlpha = tokens.wheyAlphaPeak * easeOutQuad(shrinkElapsedSec / (SHRINK_MS / 1000));
        drawWheyWash(ctx, geo, tokens, wheyAlpha);
        drawCubes(ctx, geo, tokens, cubes, shrinkElapsedSec, shrinkElapsedMs, seed, null);
        return;
      }

      if (elapsedMs < CUT_MS + SHRINK_MS + HOLD_MS) {
        drawWheyWash(ctx, geo, tokens, tokens.wheyAlphaPeak);
        drawCubes(ctx, geo, tokens, cubes, SHRINK_MS / 1000, SHRINK_MS, seed, FLOOR_FRAC);
        return;
      }

      // recombine: cube edges ease back toward a full cell, whey wash fades out
      const recElapsed = elapsedMs - (CUT_MS + SHRINK_MS + HOLD_MS);
      const p = Math.max(0, Math.min(1, recElapsed / RECOMBINE_MS));
      const eased = easeOutQuad(p);
      const sizeFrac = FLOOR_FRAC + (1 - FLOOR_FRAC) * eased;
      drawWheyWash(ctx, geo, tokens, tokens.wheyAlphaPeak * (1 - eased));
      drawCubes(ctx, geo, tokens, cubes, SHRINK_MS / 1000, SHRINK_MS, seed, sizeFrac);
    };

    const resizeAll = () => {
      if (!tokens) return;
      const rect = chartWrap.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nextGeo = computeGeo(rect.width, rect.height);
      if (nextGeo.gridN !== geo.gridN) cubes = buildCubes(nextGeo.gridN, seed);
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
      if (cycleStartMs === 0) cycleStartMs = nowRaf;
      let elapsed = nowRaf - cycleStartMs;
      if (elapsed >= LOOP_MS) {
        cubes = buildCubes(geo.gridN, seed);
        cycleStartMs = nowRaf;
        elapsed = 0;
      }
      render(elapsed);
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
        // restart the batch rather than resuming mid-flight — an arbitrarily
        // long time off-screen must not resume a stale, half-drained batch
        cubes = buildCubes(geo.gridN, seed);
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
        <p className="shrink-0 font-mono text-[10px] tracking-widest text-ns-muted">SYNERESIS</p>
      </div>
      <div ref={chartWrapRef} className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}
