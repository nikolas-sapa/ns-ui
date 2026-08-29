"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// FrazilDam — a card-scale processing/progress indicator modelled on frazil
// ice: fine, flat, mm-scale crystals that nucleate directly within turbulent
// water (rather than skinning over a still surface), are advected by the
// flow, and pile up against an obstruction — a channel narrowing, an
// ice-boom rack, the nose of an already-frozen reach — building a
// frazil/anchor-ice dam. Once accumulated mass or local hydraulics cross a
// threshold, a coherent portion sloughs off as an "ice run" and is carried
// downstream, after which accumulation resumes from a smaller residual base
// (documented in river-ice engineering literature, e.g. Beltaos, River Ice
// Formation) — never a full reset to bare channel.
//
// One canvas, cleared and redrawn every frame from a fixed-timestep (20Hz)
// simulation accumulator, mirroring how the paint-rate-decoupling guidance
// wants any real periodic process handled: the curl-noise velocity field
// that advects crystals is re-sampled at each 20Hz tick (never per-frame),
// and crystal position, dam growth and the release/chunk animation all
// advance inside that same fixed-step loop so motion never depends on
// display refresh rate.
//
// Crystals spawn at the channel's left edge at a fixed rate, drift right on
// a base current plus a divergence-free curl of a 2-octave value-noise
// potential field (the same construction as background-ascii-flow: curl of
// a scalar field guarantees the flow never "pools" a crystal — it is always
// being pushed somewhere), and lodge once they reach the dam's leading
// (upstream) face or the rack itself. The dam's crest height is driven on
// its own clock (accumulation compressed from the real minutes-to-hours
// timescale to ~15-20s, per cycle, toward a threshold measured as 70% of the
// channel's cross-section) independently of exactly which crystal lodges
// when — the crystal layer is the visible turbulent-transport texture, the
// crest curve is the legible headline metric. On crossing threshold, 35-45%
// of the accumulated crest breaks free as one coherent chunk that travels
// across and off the right edge over 1.2s while the crest itself eases down
// to a 55-65% residual base, and accumulation resumes from there.
// ---------------------------------------------------------------------------

const SIM_HZ = 20; // curl-noise field + dam/crystal sim tick rate
const SIM_STEP_S = 1 / SIM_HZ;
const SIM_STEP_MS = 1000 / SIM_HZ;
const MAX_CATCHUP_TICKS = 8; // guards against a huge dt after a tab was backgrounded

const SPAWN_RATE = 8; // crystals/s at the left edge (spec: 6-10/s)
const BASE_TRANSIT_S = 5; // baseline left-edge-to-rack transit time (spec: 2-8s)

const THRESHOLD = 0.7; // release threshold: crest at 70% of channel cross-section
const CYCLE_MIN_S = 15;
const CYCLE_MAX_S = 20; // dam accumulation compressed to ~15-20s per cycle
const RELEASE_MS = 1200; // chunk transit across and off the frame
const CREST_DROP_MS = 420; // how fast the crest itself eases down once a release fires
const RESIDUAL_MIN = 0.55;
const RESIDUAL_MAX = 0.65; // residual dam: 55-65% of prior crest survives a release

const STATIC_TOWARD_THRESHOLD = 0.55; // reduced-motion freeze: 55% of the way to threshold
const STATIC_CRYSTAL_COUNT = 8;

const NOISE_FREQ = 0.045;
const FIELD_SPEED = 0.1; // t units/s the potential drifts
const CURL_EPS = 0.5;

function hash2(ix: number, iy: number, seed: number): number {
  const s = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

function noise2D(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * tx;
  const bot = c + (d - c) * tx;
  return top + (bot - top) * ty;
}

// 2-octave scalar potential
function potential(x: number, y: number, t: number): number {
  const n1 = noise2D(x * NOISE_FREQ, y * NOISE_FREQ + t, 8.1);
  const n2 = noise2D(x * NOISE_FREQ * 2.2 - t * 0.5, y * NOISE_FREQ * 2.2, 41.7);
  return n1 * 0.7 + n2 * 0.3;
}

// curl of the potential -> divergence-free turbulent velocity, px/s once scaled
function curlVel(x: number, y: number, t: number, scale: number): [number, number] {
  const py1 = potential(x, y + CURL_EPS, t);
  const py0 = potential(x, y - CURL_EPS, t);
  const px1 = potential(x + CURL_EPS, y, t);
  const px0 = potential(x - CURL_EPS, y, t);
  const vx = ((py1 - py0) / (2 * CURL_EPS)) * scale;
  const vy = -((px1 - px0) / (2 * CURL_EPS)) * scale;
  return [vx, vy];
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

function randRange(rand: () => number, lo: number, hi: number): number {
  return lo + rand() * (hi - lo);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

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

interface Geo {
  W: number;
  H: number;
  minDim: number;
  channelTop: number;
  channelBottom: number;
  channelH: number;
  channelLen: number;
  rackX: number;
  exitX: number;
  pileMinW: number;
  pileMaxW: number;
  crystalR: number;
  curlScale: number;
  baseVx: number;
}

function computeGeo(W: number, H: number): Geo {
  const minDim = Math.min(W, H);
  const channelTop = H * 0.14;
  const channelBottom = H * 0.86;
  const channelH = channelBottom - channelTop;
  const rackX = W * 0.78;
  const exitX = W * 1.08;
  const channelLen = rackX;
  return {
    W,
    H,
    minDim,
    channelTop,
    channelBottom,
    channelH,
    channelLen,
    rackX,
    exitX,
    pileMinW: minDim * 0.09,
    pileMaxW: minDim * 0.3,
    crystalR: clamp(minDim * 0.014, 2, 4),
    curlScale: minDim * 0.5,
    baseVx: channelLen / BASE_TRANSIT_S,
  };
}

function pileWidth(crestFrac: number, g: Geo): number {
  return g.pileMinW + (crestFrac / THRESHOLD) * (g.pileMaxW - g.pileMinW);
}

/** height of the dam's ice surface above the channel floor at a given x, for the current crest fraction */
function damHeightAt(x: number, crestFrac: number, g: Geo): number {
  if (crestFrac <= 0) return 0;
  const w = pileWidth(crestFrac, g);
  const left = g.rackX - w;
  if (x < left) return 0;
  const t = clamp((x - left) / Math.max(w, 0.001), 0, 1);
  return crestFrac * g.channelH * Math.pow(t, 1.4);
}

interface Crystal {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Chunk {
  x: number;
  y: number;
  y0: number;
  startedAtMs: number;
}

type Phase = "accumulate" | "release";

interface SimState {
  crystals: Crystal[];
  spawnAcc: number;
  phase: Phase;
  cycleT: number; // seconds since this accumulation phase started
  cycleRiseS: number;
  residualBase: number; // crest fraction this cycle rises from
  releaseElapsedMs: number;
  releaseResidual: number; // crest fraction the current release settles to
  chunk: Chunk | null;
  simTimeS: number;
}

function freshSim(rand: () => number): SimState {
  return {
    crystals: [],
    spawnAcc: 0,
    phase: "accumulate",
    cycleT: 0,
    cycleRiseS: randRange(rand, CYCLE_MIN_S, CYCLE_MAX_S),
    residualBase: 0,
    releaseElapsedMs: 0,
    releaseResidual: 0,
    chunk: null,
    simTimeS: 0,
  };
}

/** current crest fraction (0..THRESHOLD) as a pure function of phase state */
function currentCrestFrac(sim: SimState): number {
  if (sim.phase === "accumulate") {
    const p = clamp(sim.cycleT / sim.cycleRiseS, 0, 1);
    const eased = smooth(p);
    return sim.residualBase + (THRESHOLD - sim.residualBase) * eased;
  }
  const dropP = clamp(sim.releaseElapsedMs / CREST_DROP_MS, 0, 1);
  const eased = smooth(dropP);
  return THRESHOLD + (sim.releaseResidual - THRESHOLD) * eased;
}

function spawnCrystal(sim: SimState, g: Geo, rand: () => number) {
  sim.crystals.push({
    x: 0,
    y: randRange(rand, g.channelTop + 3, g.channelBottom - 3),
    vx: g.baseVx,
    vy: 0,
  });
}

function beginRelease(sim: SimState, g: Geo, rand: () => number) {
  sim.phase = "release";
  sim.releaseElapsedMs = 0;
  sim.releaseResidual = THRESHOLD * randRange(rand, RESIDUAL_MIN, RESIDUAL_MAX);
  const crestY = g.channelBottom - THRESHOLD * g.channelH;
  sim.chunk = { x: g.rackX - 2, y: crestY, y0: crestY, startedAtMs: 0 };
}

function endRelease(sim: SimState, rand: () => number) {
  sim.phase = "accumulate";
  sim.residualBase = sim.releaseResidual;
  sim.cycleT = 0;
  sim.cycleRiseS = randRange(rand, CYCLE_MIN_S, CYCLE_MAX_S);
  sim.chunk = null;
}

/** advances the whole sim (spawn, curl-noise field resample, dam clock, release/chunk) by one fixed 20Hz tick */
function tick(sim: SimState, g: Geo, rand: () => number) {
  sim.simTimeS += SIM_STEP_S;

  sim.spawnAcc += SIM_STEP_S * SPAWN_RATE;
  while (sim.spawnAcc >= 1) {
    sim.spawnAcc -= 1;
    spawnCrystal(sim, g, rand);
  }

  const crestFrac = currentCrestFrac(sim);
  const t = sim.simTimeS * FIELD_SPEED;

  const next: Crystal[] = [];
  for (const c of sim.crystals) {
    const [cvx, cvy] = curlVel(c.x, c.y, t, g.curlScale);
    c.vx = g.baseVx + cvx;
    c.vy = cvy;
    c.x += c.vx * SIM_STEP_S;
    c.y += c.vy * SIM_STEP_S;
    if (c.y < g.channelTop) {
      c.y = g.channelTop;
      c.vy = Math.abs(c.vy);
    } else if (c.y > g.channelBottom) {
      c.y = g.channelBottom;
      c.vy = -Math.abs(c.vy);
    }

    if (c.x >= g.rackX) continue; // hit the rack — lodged
    const leadX = g.rackX - pileWidth(crestFrac, g);
    if (c.x >= leadX) {
      const dh = damHeightAt(c.x, crestFrac, g);
      if (c.y >= g.channelBottom - dh) continue; // lodged in the dam's face
    }
    if (c.x > g.W + 4) continue; // drifted clean past the frame, drop it
    next.push(c);
  }
  sim.crystals = next;

  if (sim.phase === "accumulate") {
    sim.cycleT += SIM_STEP_S;
    if (sim.cycleT >= sim.cycleRiseS) beginRelease(sim, g, rand);
  } else {
    sim.releaseElapsedMs += SIM_STEP_MS;
    if (sim.chunk) {
      const p = clamp(sim.releaseElapsedMs / RELEASE_MS, 0, 1);
      const eased = 1 - (1 - p) * (1 - p); // ease-out — quick break, then swept downstream
      sim.chunk.x = g.rackX - 2 + eased * (g.exitX - (g.rackX - 2));
      const [wvx, wvy] = curlVel(sim.chunk.x, sim.chunk.y0, t, g.curlScale * 0.4);
      void wvx;
      sim.chunk.y = sim.chunk.y0 + wvy * p * 0.6 + p * g.channelH * 0.08;
    }
    if (sim.releaseElapsedMs >= RELEASE_MS) endRelease(sim, rand);
  }
}

function drawWater(ctx: CanvasRenderingContext2D, g: Geo, tokens: Tokens) {
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = tokens.muted;
  ctx.fillRect(0, g.channelTop, g.W, g.channelH);
  ctx.restore();
}

function drawDam(ctx: CanvasRenderingContext2D, g: Geo, tokens: Tokens, crestFrac: number) {
  if (crestFrac <= 0.002) return;
  const w = pileWidth(crestFrac, g);
  const left = g.rackX - w;
  const steps = 20;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left, g.channelBottom);
  for (let i = 0; i <= steps; i++) {
    const x = left + (w * i) / steps;
    const y = g.channelBottom - damHeightAt(x, crestFrac, g);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(g.rackX, g.channelBottom);
  ctx.closePath();
  const crestY = g.channelBottom - crestFrac * g.channelH;
  const grad = ctx.createLinearGradient(0, crestY, 0, g.channelBottom);
  grad.addColorStop(0, tokens.fg);
  grad.addColorStop(1, tokens.muted);
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

function drawRack(ctx: CanvasRenderingContext2D, g: Geo, tokens: Tokens) {
  ctx.save();
  ctx.strokeStyle = tokens.fg;
  ctx.globalAlpha = 1;
  ctx.lineWidth = Math.max(1.5, g.minDim * 0.006);
  ctx.beginPath();
  ctx.moveTo(g.rackX, g.channelTop);
  ctx.lineTo(g.rackX, g.channelBottom);
  ctx.stroke();
  // grate ticks — reads as a structural obstruction, not a bare line
  ctx.lineWidth = Math.max(1, g.minDim * 0.004);
  ctx.globalAlpha = 0.8;
  const tickCount = 6;
  const tickLen = g.minDim * 0.02;
  for (let i = 1; i < tickCount; i++) {
    const y = g.channelTop + (g.channelH * i) / tickCount;
    ctx.beginPath();
    ctx.moveTo(g.rackX - tickLen, y);
    ctx.lineTo(g.rackX + tickLen, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCrystals(ctx: CanvasRenderingContext2D, g: Geo, tokens: Tokens, crystals: Crystal[]) {
  ctx.save();
  ctx.fillStyle = tokens.fg;
  ctx.globalAlpha = 0.78;
  for (const c of crystals) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, g.crystalR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawChunk(ctx: CanvasRenderingContext2D, g: Geo, tokens: Tokens, chunk: Chunk) {
  ctx.save();
  ctx.fillStyle = tokens.fg;
  ctx.globalAlpha = 0.9;
  const r = g.minDim * 0.045;
  const offsets: [number, number, number][] = [
    [0, 0, r],
    [-r * 0.9, r * 0.35, r * 0.65],
    [r * 0.85, -r * 0.25, r * 0.6],
  ];
  for (const [dx, dy, rr] of offsets) {
    ctx.beginPath();
    ctx.arc(chunk.x + dx, chunk.y + dy, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function render(ctx: CanvasRenderingContext2D, g: Geo, tokens: Tokens, sim: SimState) {
  ctx.clearRect(0, 0, g.W, g.H);
  drawWater(ctx, g, tokens);
  const crestFrac = currentCrestFrac(sim);
  drawDam(ctx, g, tokens, crestFrac);
  drawRack(ctx, g, tokens);
  drawCrystals(ctx, g, tokens, sim.crystals);
  if (sim.chunk) drawChunk(ctx, g, tokens, sim.chunk);
}

/** deterministically builds the reduced-motion freeze frame: mid-accumulation
 * at 55% toward threshold, several crystals visibly mid-transit. */
function buildReducedSim(g: Geo, rand: () => number): SimState {
  const sim = freshSim(rand);
  sim.cycleT = sim.cycleRiseS * STATIC_TOWARD_THRESHOLD;
  const crystals: Crystal[] = [];
  for (let i = 0; i < STATIC_CRYSTAL_COUNT; i++) {
    const x = randRange(rand, g.rackX * 0.06, g.rackX * 0.82);
    const y = randRange(rand, g.channelTop + 4, g.channelBottom - 4);
    crystals.push({ x, y, vx: g.baseVx, vy: 0 });
  }
  sim.crystals = crystals;
  return sim;
}

export interface FrazilDamProps {
  /** small mono label above the chart */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function FrazilDam({ label = "PROCESSING", className = "" }: FrazilDamProps) {
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const chartWrap = chartWrapRef.current;
    const canvas = canvasRef.current;
    if (!chartWrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rand = mulberry32(0xf2a217);

    let disposed = false;
    let tokens: Tokens | null = null;
    let dpr = 1;
    let g: Geo = computeGeo(1, 1);
    let sized = false;
    let visible = true;

    let sim = freshSim(rand);
    let raf = 0;
    let tokenWaitRaf = 0;
    let lastMs = 0;
    let acc = 0;

    const fitCanvas = () => {
      canvas.width = Math.max(1, Math.round(g.W * dpr));
      canvas.height = Math.max(1, Math.round(g.H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

    const loop = (nowMs: number) => {
      if (disposed) return;
      if (!visible) {
        raf = 0; // IntersectionObserver re-arms this on re-entering view
        return;
      }
      raf = requestAnimationFrame(loop);
      if (!sized || !tokens) return;
      if (lastMs === 0) lastMs = nowMs;
      acc += Math.min(200, nowMs - lastMs);
      lastMs = nowMs;
      let ticks = 0;
      while (acc >= SIM_STEP_MS && ticks < MAX_CATCHUP_TICKS) {
        acc -= SIM_STEP_MS;
        tick(sim, g, rand);
        ticks += 1;
      }
      render(ctx, g, tokens, sim);
    };

    const buildReducedFrame = () => {
      if (!tokens) return;
      sim = buildReducedSim(g, mulberry32(0xc0ffee));
      render(ctx, g, tokens, sim);
    };

    let started = false;
    const kick = () => {
      if (started || disposed || !tokens || !sized) return;
      started = true;
      if (reduced) {
        buildReducedFrame();
        return; // no rAF loop, no timers — a single deterministic frame
      }
      lastMs = 0;
      acc = 0;
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
        lastMs = 0;
        acc = 0;
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
    <div className={`relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-surface p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="truncate font-mono text-[11px] tracking-widest text-ns-muted">{label}</p>
        <p className="shrink-0 font-mono text-[10px] tracking-widest text-ns-muted">FRAZIL</p>
      </div>
      <div ref={chartWrapRef} className="relative w-full" style={{ aspectRatio: "3 / 4" }}>
        <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}
