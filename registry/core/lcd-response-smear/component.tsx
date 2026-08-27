"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// LcdResponseSmear — an ambient panel-diagnostics status card whose canvas
// strip simulates LCD pixel response time compensation (RTC / overdrive): a
// liquid-crystal cell doesn't switch luminance instantly between grey
// levels, and rise/fall are asymmetric (rise faster, fall slower on typical
// TN/IPS spec sheets). Panel drivers overdrive the transition — push past
// the target voltage, then relax back — producing a brief bright overshoot
// on a rising transition. Falling transitions are usually driven less
// aggressively, so instead of overshooting past the target they UNDERSHOOT
// it: the cell lags behind the ideal step and arrives at its dark target
// later and more gradually. That rise-overshoots / fall-undershoots
// asymmetry is the "inverse ghost" visible trailing fast light-on-dark UI in
// reviews of LCD panels with aggressive overdrive — this card renders it as
// a single sweeping fill boundary crossing a row of cells: cells left of the
// boundary are lit, cells right are unlit, and the boundary ping-pongs
// across the strip. Every cell it newly lights up plays the rise-overshoot
// curve; every cell it newly darkens (boundary retreating past it) plays
// the fall-undershoot curve — both computed relative to each cell's own
// local start/end luminance, never an absolute white/black, so the effect
// self-corrects across light/dark themes for free.
//
// NOT motion blur: kelvin-wake, and this project's other trailing-wake
// components, render a continuous gradient smear. This is a discrete
// per-cell luminance curve with two distinct named keyframes (a peak or dip,
// then a settle) — an instant state change at the moment the boundary
// crosses a cell, not a spatial blur convolved across the frame. NOT
// cursor-subpixel-fringe either — that's a spatial subpixel-geometry
// artifact; this is a purely temporal per-pixel response curve.
//
// REAL NUMBERS (see riseCurve / fallCurve below):
//   rise: overshoots to 1.18x the local luminance delta, settles to 1.0x
//   (spec: t+4ms peak, t+9ms settle, tau_rise ~= 6ms).
//   fall: undershoots — reaches only 0.90x of the local delta before it has
//   fully arrived (spec: t+6ms), then eases the rest of the way, settling
//   to 1.0x (spec: t+15ms, tau_fall ~= 11ms). Falling literally takes
//   longer and lags rather than punching through the target, which is the
//   asymmetry real GtG spec sheets report (fall consistently slower than
//   rise). DEVIATION FROM SPEC, DELIBERATE: those millisecond values are
//   real, but at 220px/s a genuine 9ms/15ms transition only spans ~2-3px —
//   thinner than one CELL_PX floor, i.e. invisible. The keyframe TIMES
//   below are the spec's real numbers x20 (RISE_PEAK/SETTLE_MS,
//   FALL_DIP/SETTLE_MS) so the halo spans several cells and reads as the
//   asymmetric spike it's supposed to be; every RATIO that carries the
//   mechanic's identity (4:9, 6:15, the 6:11 tau ratio, 1.18x, 0.90x) is
//   exactly preserved. The footer readout still states the true panel
//   numbers (6ms / 11ms) — only the on-screen playback speed is dilated,
//   the same way a macro lens dilates space rather than lying about it.
//   sweep velocity v(t) = 220 * (1 + 0.15*sin(2*PI*t / 9.1)) px/s, boundary
//   position ping-pongs off the strip's own edges; the slow, non-round
//   9.1s modulation keeps the bounce from reading as a metronomic loop.
//
// Geometry: CELL_PX = max(6, containerMinDim / 56), a single row of cells
// spanning the strip's own width, containerMinDim taken from the CARD's own
// bounding rect (not the thin strip's) so the pattern scales with the card
// as a whole rather than reading as one fixed pixel size regardless of how
// large the card is laid out.
//
// House idiom duplicated on purpose (no shared helpers, per project
// convention): tokens (--background / --foreground only — this is value,
// never hue) read via getComputedStyle(document.documentElement) inside a
// pre-paint effect and re-read on a MutationObserver watching
// documentElement's class; one rAF loop paused on document visibilitychange
// and an IntersectionObserver on the strip; DPR-capped(2) backing store
// with a ResizeObserver-driven resize and a zero-size guard.
//
// prefers-reduced-motion: no rAF loop. A single frame is composed by
// deterministically replaying the same boundary-integration + per-cell
// crossing logic from t=0 up to STATIC_TIME = 0.85s (so the boundary lands
// somewhere real, not an arbitrary fixed spot), then the render pass pins
// whichever cell was crossed most recently to the exact peak/dip instant of
// its curve (rise: t+4ms, fall: t+6ms) instead of whatever age it actually
// has — guaranteeing the frozen frame always shows the climactic overshoot
// halo rather than risking landing on an already-settled, plain static
// edge for some container sizes.
// ---------------------------------------------------------------------------

const CELL_MIN_PX = 6;
const CELL_DIVISOR = 56;

const SWEEP_BASE_V = 220; // px/s
const SWEEP_MOD_AMP = 0.15;
const SWEEP_MOD_PERIOD = 9.1; // s, deliberately non-round

// x20 time-dilation of the spec's real 4/9/6/15ms keyframes — see the
// header comment. Ratios (4:9, 6:15, 1.18x, 0.90x) are exact; only the
// playback speed is stretched so the halo is wide enough to see.
const TIME_DILATION = 20;
const RISE_PEAK = 1.18;
const RISE_PEAK_MS = 4 * TIME_DILATION;
const RISE_SETTLE_MS = 9 * TIME_DILATION;

const FALL_DIP = 0.9;
const FALL_DIP_MS = 6 * TIME_DILATION;
const FALL_SETTLE_MS = 15 * TIME_DILATION;

// Interior grey levels rather than pure 0/1: at LIT=1 the 18% rise
// overshoot extrapolates past the foreground token and clamps, losing most
// of its visible amplitude. Sitting the settled levels inside the range
// leaves headroom on both sides for the over/undershoot to actually show.
const LIT = 0.86;
const UNLIT = 0.06;

const STATIC_TIME_S = 0.85;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Fraction of the local luminance delta reached at `ms` since a cell was
// newly lit. Overshoots to RISE_PEAK before easing back down to 1.0.
function riseCurve(ms: number): number {
  if (ms <= 0) return 0;
  if (ms < RISE_PEAK_MS) return smoothstep(0, RISE_PEAK_MS, ms) * RISE_PEAK;
  if (ms < RISE_SETTLE_MS) {
    const t = smoothstep(RISE_PEAK_MS, RISE_SETTLE_MS, ms);
    return RISE_PEAK + (1 - RISE_PEAK) * t;
  }
  return 1;
}

// Fraction of the local luminance delta reached at `ms` since a cell was
// newly darkened. Undershoots (lags short of the target) at FALL_DIP before
// easing the rest of the way in — no overshoot past 1, a slower catch-up.
function fallCurve(ms: number): number {
  if (ms <= 0) return 0;
  if (ms < FALL_DIP_MS) return smoothstep(0, FALL_DIP_MS, ms) * FALL_DIP;
  if (ms < FALL_SETTLE_MS) {
    const t = smoothstep(FALL_DIP_MS, FALL_SETTLE_MS, ms);
    return FALL_DIP + (1 - FALL_DIP) * t;
  }
  return 1;
}

function settleMsFor(kind: 1 | -1): number {
  return kind === 1 ? RISE_SETTLE_MS : FALL_SETTLE_MS;
}
function peakMsFor(kind: 1 | -1): number {
  return kind === 1 ? RISE_PEAK_MS : FALL_DIP_MS;
}

type Vec3 = [number, number, number];

// Same parse+mix idiom used elsewhere in this registry (e.g.
// table-heat-shimmer) — duplicated per house convention rather than shared.
function parseColor(raw: string): Vec3 | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0], 16);
      const g = parseInt(hex[1]! + hex[1], 16);
      const b = parseInt(hex[2]! + hex[2], 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// Lerp (and, for overshoot/undershoot fractions outside [0,1], deliberately
// EXTRAPOLATE) between two colours, clamped per-channel so an 18% overshoot
// never wraps past a byte.
function mixExtrapolate(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    clamp(Math.round(a[0] + (b[0] - a[0]) * t), 0, 255),
    clamp(Math.round(a[1] + (b[1] - a[1]) * t), 0, 255),
    clamp(Math.round(a[2] + (b[2] - a[2]) * t), 0, 255),
  ];
}

interface CellSim {
  cellCount: number;
  kind: Int8Array; // 0 none, 1 rise, -1 fall
  transStart: Float64Array; // ms, timeline-local
  // Settled target level for a cell with kind === 0 (0 = unlit, 1 = lit).
  // Read directly rather than re-derived from the boundary's current
  // position — deriving it from position instead caused every cell to
  // flicker dark-then-lit right as its transition settled, because
  // crossing detection keys off cell EDGES (floor(idx)) while position
  // comparison keys off cell CENTERS, and those two didn't agree at settle
  // time. `level` is authoritative and updated only at crossing.
  level: Int8Array;
}

function makeSim(cellCount: number, seedPos: number, cellPx: number): CellSim {
  const level = new Int8Array(cellCount);
  for (let i = 0; i < cellCount; i++) {
    level[i] = (i + 0.5) * cellPx < seedPos ? 1 : 0;
  }
  return {
    cellCount,
    kind: new Int8Array(cellCount),
    transStart: new Float64Array(cellCount).fill(-Infinity),
    level,
  };
}

/** One boundary-integration step: advances pos/sign by dtSec at simTimeS,
 * and marks every cell the boundary newly crossed as rise (lighting up,
 * boundary advancing) or fall (darkening, boundary retreating), timestamped
 * at `nowMs` on whatever timeline the caller is running (real or replayed). */
function stepSim(
  sim: CellSim,
  cellPx: number,
  trackW: number,
  state: { pos: number; sign: 1 | -1; simTimeS: number },
  dtSec: number,
  nowMs: number
): void {
  if (trackW <= 0 || dtSec <= 0) return;
  const prevIdxF = state.pos / cellPx;
  state.simTimeS += dtSec;
  const speed = SWEEP_BASE_V * (1 + SWEEP_MOD_AMP * Math.sin((2 * Math.PI * state.simTimeS) / SWEEP_MOD_PERIOD));
  let pos = state.pos + speed * state.sign * dtSec;
  let sign = state.sign;
  if (pos > trackW) {
    pos = 2 * trackW - pos;
    sign = -1;
  } else if (pos < 0) {
    pos = -pos;
    sign = 1;
  }
  state.pos = clamp(pos, 0, trackW);
  state.sign = sign;
  const newIdxF = state.pos / cellPx;

  const cellCount = sim.cellCount;
  if (newIdxF > prevIdxF) {
    const lo = Math.max(0, Math.floor(prevIdxF));
    const hi = Math.min(cellCount - 1, Math.floor(newIdxF));
    for (let i = lo + (prevIdxF > lo ? 1 : 0); i <= hi; i++) {
      sim.kind[i] = 1;
      sim.transStart[i] = nowMs;
      sim.level[i] = 1;
    }
  } else if (newIdxF < prevIdxF) {
    const lo = Math.max(0, Math.floor(newIdxF));
    const hi = Math.min(cellCount - 1, Math.floor(prevIdxF));
    for (let i = hi; i >= lo + 1; i--) {
      sim.kind[i] = -1;
      sim.transStart[i] = nowMs;
      sim.level[i] = 0;
    }
  }
}

function renderSim(
  ctx: CanvasRenderingContext2D,
  sim: CellSim,
  cellPx: number,
  trackW: number,
  h: number,
  nowMs: number,
  bg: Vec3,
  fg: Vec3
): void {
  ctx.clearRect(0, 0, trackW, h);
  const gap = Math.max(1, cellPx * 0.08);
  for (let i = 0; i < sim.cellCount; i++) {
    const kind = sim.kind[i] as 0 | 1 | -1;
    let lum: number;
    if (kind !== 0) {
      let elapsed = nowMs - sim.transStart[i]!;
      const settle = settleMsFor(kind);
      if (elapsed >= settle) {
        sim.kind[i] = 0;
        lum = kind === 1 ? LIT : UNLIT;
      } else {
        if (elapsed < 0) elapsed = 0;
        const frac = kind === 1 ? riseCurve(elapsed) : fallCurve(elapsed);
        const from = kind === 1 ? UNLIT : LIT;
        const to = kind === 1 ? LIT : UNLIT;
        lum = from + (to - from) * frac;
      }
    } else {
      lum = sim.level[i] ? LIT : UNLIT;
    }
    const [r, g, b] = mixExtrapolate(bg, fg, lum);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(i * cellPx, 0, Math.max(1, cellPx - gap), h);
  }
}

export interface LcdResponseSmearProps {
  /** small mono eyebrow above the title */
  eyebrow?: string;
  /** card title */
  title?: string;
  /** supporting description under the title */
  description?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function LcdResponseSmear({
  eyebrow = "PANEL DIAGNOSTICS",
  title = "Response compensation",
  description = "Overdrive pushes each cell past its target voltage to hit its advertised switching time — the trace below is a simulated row of LCD cells lighting and darkening as a boundary sweeps across them, each rise overshooting its target before settling, each fall lagging behind before it catches up.",
  className = "",
}: LcdResponseSmearProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const strip = stripRef.current;
    const canvas = canvasRef.current;
    if (!root || !strip || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // No colour literal fallbacks, per project rule — null until the first
    // real token read succeeds, and every draw path below guards on it so
    // nothing can paint before that first read.
    let bg: Vec3 | null = null;
    let fg: Vec3 | null = null;
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = parseColor(cs.getPropertyValue("--background")) ?? bg;
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
    };
    readTokens();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let raf = 0;
    let running = false;
    let visible = true;

    let cellPx = CELL_MIN_PX;
    let trackW = 0;
    let trackH = 0;
    let sim = makeSim(0, 0, CELL_MIN_PX);
    const state = { pos: 0, sign: 1 as 1 | -1, simTimeS: 0 };
    let lastTs = 0;

    const draw = (nowMs: number) => {
      if (!bg || !fg) return; // no paint before the first token read
      renderSim(ctx, sim, cellPx, trackW, trackH, nowMs, bg, fg);
    };

    const drawStatic = () => {
      if (trackW <= 0 || cellPx <= 0 || !bg || !fg) return;
      // Seed the replay at the same t0 boundary position the live loop
      // starts from, so the static frame and the live t0 frame agree.
      const seedPos = 0.38 * trackW;
      const localSim = makeSim(sim.cellCount, seedPos, cellPx);
      const localState = { pos: seedPos, sign: 1 as 1 | -1, simTimeS: 0 };
      const dt = 1 / 240;
      let nowMs = 0;
      const targetMs = STATIC_TIME_S * 1000;
      while (nowMs < targetMs) {
        const step = Math.min(dt, (targetMs - nowMs) / 1000);
        stepSim(localSim, cellPx, trackW, localState, step, nowMs + step * 1000);
        nowMs += step * 1000;
      }
      // Find the most recently triggered transition and pin its render age
      // to its curve's named peak/dip instant, guaranteeing the frozen
      // frame shows the climactic halo rather than an already-settled edge.
      let pinIdx = -1;
      let pinStart = -Infinity;
      for (let i = 0; i < localSim.cellCount; i++) {
        if (localSim.kind[i] !== 0 && localSim.transStart[i]! > pinStart) {
          pinStart = localSim.transStart[i]!;
          pinIdx = i;
        }
      }
      if (pinIdx >= 0) {
        const kind = localSim.kind[pinIdx] as 1 | -1;
        localSim.transStart[pinIdx] = targetMs - peakMsFor(kind);
      }
      renderSim(ctx, localSim, cellPx, trackW, trackH, targetMs, bg, fg);
    };

    const loop = (ts: number) => {
      if (disposed) return;
      const dtMs = lastTs === 0 ? 16 : Math.min(100, ts - lastTs);
      lastTs = ts;
      stepSim(sim, cellPx, trackW, state, dtMs / 1000, ts);
      draw(ts);
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (running || reduced) return;
      running = true;
      lastTs = 0;
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      running = false;
    };

    const resize = () => {
      const cardRect = root.getBoundingClientRect();
      const containerMinDim = Math.max(1, Math.min(cardRect.width, cardRect.height));
      cellPx = Math.max(CELL_MIN_PX, containerMinDim / CELL_DIVISOR);

      const rect = strip.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return; // zero-size guard
      trackW = rect.width;
      trackH = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(trackW * dpr);
      canvas.height = Math.round(trackH * dpr);
      canvas.style.width = `${trackW}px`;
      canvas.style.height = `${trackH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cellCount = Math.max(4, Math.floor(trackW / cellPx));
      // t0 must be mid-sweep, not blank — seed the boundary partway across
      // the strip rather than at 0 (spec: "t0: edge mid-sweep").
      const seedPos = 0.38 * trackW;
      sim = makeSim(cellCount, seedPos, cellPx);
      state.pos = seedPos;
      state.sign = 1;
      state.simTimeS = 0;
      lastTs = 0;

      if (reduced) drawStatic();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(root);
    ro.observe(strip);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[entries.length - 1]?.isIntersecting ?? true;
        if (!reduced) {
          if (visible) wake();
          else sleep();
        }
      },
      { threshold: 0 }
    );
    io.observe(strip);

    const themeObserver = new MutationObserver(() => {
      readTokens();
      if (reduced) drawStatic();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onVis = () => {
      if (reduced) return;
      if (document.hidden) sleep();
      else if (visible) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    resize();
    if (!reduced) wake();
    else drawStatic();

    return () => {
      disposed = true;
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      sleep();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`rounded-md border border-border bg-background p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-widest text-ns-muted">{eyebrow}</p>
          <h3 className="mt-1 text-base font-semibold text-foreground">{title}</h3>
        </div>
        <span className="shrink-0 rounded-sm border border-border px-2 py-0.5 font-mono text-[10px] text-ns-muted">
          RTC
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ns-muted">{description}</p>
      <div
        ref={stripRef}
        aria-hidden="true"
        className="relative mt-4 h-16 w-full overflow-hidden rounded-sm border border-border sm:h-20"
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
      <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-ns-muted">
        <span>RISE τ 6ms</span>
        <span>FALL τ 11ms</span>
        <span>OVERDRIVE COMPENSATED</span>
      </div>
    </div>
  );
}
