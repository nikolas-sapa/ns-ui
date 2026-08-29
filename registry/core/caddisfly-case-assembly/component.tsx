"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// CaddisflyCaseAssembly — a card-scale ambient loader modelled on Trichoptera
// (caddisfly larva) case-building: the larva selects mineral grains from the
// substrate one at a time, tests each roughly by size against the open gap
// at the case's growing rim, and either cements an accepted grain onto the
// rim's advancing edge with silk or lets a rejected one drift away, working
// around the rim in a rough spiral course so the tube extends and widens as
// courses complete (Hansell 1968, "The house-building behaviour of the
// caddis fly larva").
//
// One candidate grain is evaluated every 340ms, sampled from a bimodal
// substrate-grade size mix (60% "fine" 3-5px, 40% "coarse" 6-9px at card
// scale). It is accepted only if the current rim gap is within +-22% of its
// size — about half of all candidates visibly bounce off before one sticks,
// which is the mechanic's whole point, not incidental noise. An accepted
// grain eases into place over 220ms and the build cursor advances along the
// rim by its width; a rejected one drifts 18px away at a random angle while
// fading over 260ms — a clearly different, clearly slower motion than a
// cement, so accept vs. reject reads as two distinct verdicts, not one blur.
//
// Only the ACTIVE course renders individual cemented grains (--ns-muted
// fill, --border outline per grain). Once a course wraps a full
// circumference the whole case's visible "depth" grows: that course's
// grains are dropped and replaced by a single offset guide ring in
// --border, drawn behind the new (larger-radius) active rim, and a fresh
// course starts. After 5 courses the finished case holds for 4s, then its
// last course's grain fill crossfades into its own guide ring over 1.5s (so
// the whole case reads as border-outline-only for a beat) before the entire
// case clears and a fresh one restarts from a bare rim.
// ---------------------------------------------------------------------------

const TOTAL_COURSES = 5;
const CANDIDATE_INTERVAL_MS = 340; // one candidate evaluated per this
const DRIFT_MS = 100; // candidate drifts in from outside the rim
const PAUSE_MS = 20; // brief hover at the gap before the verdict plays
const ACCEPT_MS = 220; // ease-out into cemented position
const REJECT_MS = 260; // bounce-away-and-fade
const ACCEPT_BAND = 0.22; // +-22% gap-vs-grain tolerance
const HOLD_MS = 4000; // completed case holds before it fades
const FADE_MS = 1500; // last course crossfades grains -> guide ring

const REF_DIM = 260; // reference min-dimension the px numbers below are tuned at
const FINE_MIN = 3;
const FINE_MAX = 5;
const COARSE_MIN = 6;
const COARSE_MAX = 9;
const FINE_PROB = 0.6;
const REJECT_DRIFT_REF = 18;
const HOVER_GAP_REF = 6; // radial standoff a candidate hovers at before its verdict

const CONTRAST_THRESHOLD = 0.12; // normalised luminance gap below which "low contrast"
const OUTLINE_ALPHA_BASE = 0.55;
const OUTLINE_ALPHA_LOW_CONTRAST = 0.85;

interface Tokens {
  muted: string;
  border: string;
  grainOutlineAlpha: number;
}

/** rasterises a CSS colour string through a 1x1 canvas to read its actual luminance —
 * used only to compare --border against --background, never to hardcode a colour. */
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
  const muted = cs.getPropertyValue("--ns-muted").trim();
  const border = cs.getPropertyValue("--border").trim();
  const background = cs.getPropertyValue("--background").trim();
  if (!muted || !border || !background) return null; // not loaded yet — no paint before this
  let grainOutlineAlpha = OUTLINE_ALPHA_BASE;
  try {
    const contrast = Math.abs(luminanceOf(border) - luminanceOf(background)) / 255;
    grainOutlineAlpha = contrast < CONTRAST_THRESHOLD ? OUTLINE_ALPHA_LOW_CONTRAST : OUTLINE_ALPHA_BASE;
  } catch {
    grainOutlineAlpha = OUTLINE_ALPHA_BASE;
  }
  return { muted, border, grainOutlineAlpha };
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

/** samples one grain size (px, already scaled) from the fine/coarse substrate mix */
function sampleGrainSize(scale: number, rand: () => number): number {
  const fine = rand() < FINE_PROB;
  const [lo, hi] = fine ? [FINE_MIN, FINE_MAX] : [COARSE_MIN, COARSE_MAX];
  return (lo + rand() * (hi - lo)) * scale;
}

/** irregular tube-cross-section radius at angle theta for a given course —
 * two low harmonics, seeded per course, so the rim reads as a real substrate
 * boundary rather than a perfect circle */
function rimNoise(courseIdx: number, theta: number): number {
  return (
    1 +
    0.035 * Math.sin(3 * theta + courseIdx * 1.7) +
    0.02 * Math.sin(7 * theta + courseIdx * 0.6 + 1.1)
  );
}

function traceRim(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  courseIdx: number
) {
  const steps = 64;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const r = radius * rimNoise(courseIdx, theta);
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawRoundedQuad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  fillStyle: string,
  fillAlpha: number,
  strokeStyle: string,
  strokeAlpha: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  const r = size * 0.28;
  ctx.beginPath();
  ctx.roundRect(-size / 2, -size / 2, size, size, r);
  ctx.globalAlpha = fillAlpha;
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.globalAlpha = strokeAlpha;
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = Math.max(0.6, size * 0.08);
  ctx.stroke();
  ctx.restore();
}

interface CementedGrain {
  angle: number;
  size: number;
  rotation: number;
}

interface Candidate {
  spawnMs: number;
  angle: number;
  size: number;
  rotation: number;
  radius: number; // active course radius at spawn time
  courseAtSpawn: number; // which course this candidate belongs to
  accepted: boolean;
  driftAngle: number; // random escape heading, only used if rejected
}

interface SimState {
  phase: "grow" | "hold" | "fade";
  phaseStartMs: number;
  courseIdx: number; // 0-indexed active course
  cursorAngle: number; // 0..2*PI build progress within the active course
  gapWidth: number; // current open-gap size at the active build edge
  completedRadii: number[]; // guide-ring radii for finished courses
  grains: CementedGrain[]; // cemented grains of the ACTIVE course only
  candidates: Candidate[];
  nextCandidateAtMs: number;
}

function freshSim(rand: () => number, scale: number): SimState {
  return {
    phase: "grow",
    phaseStartMs: 0,
    courseIdx: 0,
    cursorAngle: 0,
    gapWidth: sampleGrainSize(scale, rand),
    completedRadii: [],
    grains: [],
    candidates: [],
    nextCandidateAtMs: 0,
  };
}

interface Geo {
  W: number;
  H: number;
  cx: number;
  cy: number;
  R0: number;
  scale: number;
  depthStep: number;
}

function computeGeo(W: number, H: number): Geo {
  const minDim = Math.min(W, H);
  const scale = minDim / REF_DIM;
  return {
    W,
    H,
    cx: W / 2,
    cy: H / 2,
    R0: minDim * 0.18,
    scale,
    depthStep: 5 * scale,
  };
}

function courseRadius(g: Geo, courseIdx: number): number {
  return g.R0 + courseIdx * g.depthStep;
}

/** advances the deterministic case-building sim up to nowMs, spawning/resolving
 * candidates and committing accepted grains as their cement animation completes */
function stepSim(sim: SimState, nowMs: number, g: Geo, rand: () => number) {
  if (sim.phase !== "grow") return;

  while (sim.nextCandidateAtMs <= nowMs) {
    const spawnMs = sim.nextCandidateAtMs;
    sim.nextCandidateAtMs += CANDIDATE_INTERVAL_MS;
    const size = sampleGrainSize(g.scale, rand);
    const accepted = Math.abs(sim.gapWidth - size) <= ACCEPT_BAND * size;
    const angle = sim.cursorAngle + (accepted ? size / courseRadius(g, sim.courseIdx) / 2 : 0);
    sim.candidates.push({
      spawnMs,
      angle,
      size,
      rotation: rand() * Math.PI * 2,
      radius: courseRadius(g, sim.courseIdx),
      courseAtSpawn: sim.courseIdx,
      accepted,
      driftAngle: rand() * Math.PI * 2,
    });

    if (accepted) {
      const arc = size / courseRadius(g, sim.courseIdx);
      sim.cursorAngle += arc;
      sim.gapWidth = sampleGrainSize(g.scale, rand);
      if (sim.cursorAngle >= Math.PI * 2) {
        // course complete: it becomes a guide ring, active course resets
        const finishedCourse = sim.courseIdx;
        sim.grains = [];
        sim.cursorAngle = 0;
        sim.gapWidth = sampleGrainSize(g.scale, rand);
        if (finishedCourse >= TOTAL_COURSES - 1) {
          sim.phase = "hold";
          sim.phaseStartMs = spawnMs;
          // the just-finished last course still shows its cemented grains
          // through hold; only completed courses BEFORE it become rings now
          return;
        }
        sim.completedRadii.push(courseRadius(g, finishedCourse));
        sim.courseIdx = finishedCourse + 1;
      }
    }
  }

  // fold any candidate whose accept animation has finished into the
  // permanent grain list for the (still-active) course it belongs to
  sim.candidates = sim.candidates.filter((c) => {
    const age = nowMs - c.spawnMs;
    const total = DRIFT_MS + PAUSE_MS + (c.accepted ? ACCEPT_MS : REJECT_MS);
    if (age < total) return true;
    // only fold into the permanent list if its course is still the active
    // one — a candidate whose course completed mid-animation is already
    // represented by that course's guide ring instead
    if (c.accepted && c.courseAtSpawn === sim.courseIdx) {
      sim.grains.push({ angle: c.angle, size: c.size, rotation: c.rotation });
    }
    return false;
  });
}

function drawGrainAt(
  ctx: CanvasRenderingContext2D,
  g: Geo,
  radius: number,
  angle: number,
  size: number,
  rotation: number,
  tokens: Tokens,
  fillAlpha: number,
  strokeAlpha: number
) {
  const x = g.cx + radius * Math.cos(angle);
  const y = g.cy + radius * Math.sin(angle);
  drawRoundedQuad(ctx, x, y, size, rotation, tokens.muted, fillAlpha, tokens.border, strokeAlpha);
}

function drawCandidate(
  ctx: CanvasRenderingContext2D,
  g: Geo,
  c: Candidate,
  nowMs: number,
  tokens: Tokens
) {
  const age = nowMs - c.spawnMs;
  const hoverR = c.radius + HOVER_GAP_REF * g.scale;
  if (age < DRIFT_MS) {
    const p = age / DRIFT_MS;
    const eased = 1 - (1 - p) * (1 - p);
    const fromR = c.radius + HOVER_GAP_REF * g.scale * 4;
    const r = fromR + (hoverR - fromR) * eased;
    drawGrainAt(ctx, g, r, c.angle, c.size, c.rotation, tokens, eased, eased * tokens.grainOutlineAlpha);
    return;
  }
  if (age < DRIFT_MS + PAUSE_MS) {
    drawGrainAt(ctx, g, hoverR, c.angle, c.size, c.rotation, tokens, 1, tokens.grainOutlineAlpha);
    return;
  }
  const resolveAge = age - DRIFT_MS - PAUSE_MS;
  if (c.accepted) {
    const p = Math.min(1, resolveAge / ACCEPT_MS);
    const eased = 1 - (1 - p) ** 3; // ease-out cubic
    const r = hoverR + (c.radius - hoverR) * eased;
    drawGrainAt(ctx, g, r, c.angle, c.size, c.rotation, tokens, 1, tokens.grainOutlineAlpha);
  } else {
    const p = Math.min(1, resolveAge / REJECT_MS);
    const dist = REJECT_DRIFT_REF * g.scale * p;
    const x = g.cx + hoverR * Math.cos(c.angle) + Math.cos(c.driftAngle) * dist;
    const y = g.cy + hoverR * Math.sin(c.angle) + Math.sin(c.driftAngle) * dist;
    const alpha = 1 - p;
    drawRoundedQuad(ctx, x, y, c.size, c.rotation, tokens.muted, alpha, tokens.border, alpha * tokens.grainOutlineAlpha);
  }
}

/** deterministic mid-third-course frame for prefers-reduced-motion: 2 complete
 * courses as guide rings, third course half-built with an irregular mixed rim */
function buildReducedFrame(g: Geo): SimState {
  const rand = mulberry32(0x6c1d5f);
  const sim: SimState = {
    phase: "hold", // static — no candidates in flight, no further ticks
    phaseStartMs: 0,
    courseIdx: 2,
    cursorAngle: Math.PI,
    gapWidth: sampleGrainSize(g.scale, rand),
    completedRadii: [courseRadius(g, 0), courseRadius(g, 1)],
    grains: [],
    candidates: [],
    nextCandidateAtMs: 0,
  };
  const radius = courseRadius(g, 2);
  let angle = 0;
  while (angle < Math.PI) {
    const size = sampleGrainSize(g.scale, rand);
    const arc = size / radius;
    sim.grains.push({ angle: angle + arc / 2, size, rotation: rand() * Math.PI * 2 });
    angle += arc;
  }
  return sim;
}

function render(
  ctx: CanvasRenderingContext2D,
  g: Geo,
  sim: SimState,
  nowMs: number,
  tokens: Tokens
) {
  ctx.clearRect(0, 0, g.W, g.H);

  sim.completedRadii.forEach((r, i) => {
    ctx.save();
    ctx.globalAlpha = tokens.grainOutlineAlpha;
    ctx.strokeStyle = tokens.border;
    ctx.lineWidth = 1;
    traceRim(ctx, g.cx, g.cy, r, i);
    ctx.stroke();
    ctx.restore();
  });

  const activeRadius = courseRadius(g, sim.courseIdx);

  let ringAlpha = tokens.grainOutlineAlpha;
  let grainAlpha = 1;
  if (sim.phase === "fade") {
    const p = Math.min(1, (nowMs - sim.phaseStartMs) / FADE_MS);
    grainAlpha = 1 - p;
    ringAlpha = tokens.grainOutlineAlpha * p;
  }

  ctx.save();
  ctx.globalAlpha = ringAlpha;
  ctx.strokeStyle = tokens.border;
  ctx.lineWidth = 1;
  traceRim(ctx, g.cx, g.cy, activeRadius, sim.courseIdx);
  ctx.stroke();
  ctx.restore();

  if (grainAlpha > 0.01) {
    for (const grain of sim.grains) {
      drawGrainAt(
        ctx,
        g,
        activeRadius,
        grain.angle,
        grain.size,
        grain.rotation,
        tokens,
        grainAlpha,
        grainAlpha * tokens.grainOutlineAlpha
      );
    }
    if (sim.phase === "grow") {
      for (const c of sim.candidates) drawCandidate(ctx, g, c, nowMs, tokens);
    }
  }
}

export interface CaddisflyCaseAssemblyProps {
  /** small mono label above the case */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function CaddisflyCaseAssembly({
  label = "ASSEMBLING",
  className = "",
}: CaddisflyCaseAssemblyProps) {
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

    const rand = mulberry32(0x9a3c1e);
    let sim: SimState = freshSim(rand, g.scale);
    let cycleStartMs = 0;
    let raf = 0;
    let tokenWaitRaf = 0;

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

    const loop = (nowRaf: number) => {
      if (disposed) return;
      if (!visible) {
        raf = 0; // IntersectionObserver re-arms this on re-entering view
        return;
      }
      raf = requestAnimationFrame(loop);
      if (!sized || !tokens) return;
      if (cycleStartMs === 0) cycleStartMs = nowRaf;
      const elapsed = nowRaf - cycleStartMs;

      if (sim.phase === "grow") {
        stepSim(sim, elapsed, g, rand);
      } else if (sim.phase === "hold" && elapsed - sim.phaseStartMs >= HOLD_MS) {
        sim.phase = "fade";
        sim.phaseStartMs = elapsed;
      } else if (sim.phase === "fade" && elapsed - sim.phaseStartMs >= FADE_MS) {
        sim = freshSim(rand, g.scale);
        cycleStartMs = nowRaf;
        render(ctx, g, sim, 0, tokens);
        return;
      }
      render(ctx, g, sim, elapsed, tokens);
    };

    let started = false;
    const kick = () => {
      if (started || disposed || !tokens || !sized) return;
      started = true;
      if (reduced) {
        sim = buildReducedFrame(g);
        render(ctx, g, sim, 0, tokens);
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
      if (reduced) {
        sim = buildReducedFrame(g);
        render(ctx, g, sim, 0, tokens);
      }
      kick();
    });
    ro.observe(chartWrap);

    const mo = new MutationObserver(() => {
      tokens = readTokens();
      if (tokens) {
        resizeAll();
        if (reduced) {
          sim = buildReducedFrame(g);
          render(ctx, g, sim, 0, tokens);
        }
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
        // restart the whole case rather than resuming mid-flight — an
        // arbitrarily long time off-screen must not resume a stale build
        sim = freshSim(rand, g.scale);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-surface p-4 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="truncate font-mono text-[11px] tracking-widest text-ns-muted">{label}</p>
        <p className="shrink-0 font-mono text-[10px] tracking-widest text-ns-muted">CASE</p>
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
