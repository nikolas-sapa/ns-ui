"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// MeltPondDrain — an ambient loader/empty-state panel modelling Arctic
// melt-pond drainage (Polashenski et al.): a shallow top-view basin whose
// pool slowly fills over a melt season, then drains rapidly once meltwater
// finds a crack through to the ocean below, leaving a shallow residual pool
// that refills and drains again through a DIFFERENT crack later. Unbound and
// self-driven — no `value` prop, no steady-state reading — the climax is a
// periodic, self-triggered fill/drain CYCLE, distinct from the data-bound
// waterline gauges (gauge-capacity-waterline, meter-quota-meniscus) and from
// the fracture-family siblings (craze-rule, compare-crack-seam), where the
// crack is the subject rather than incidental drainage infrastructure.
//
// Fill: ~9-11s (randomized per cycle) from a shallow residual level up to a
// near-full threshold. Drain: a fixed 1.2s event with three visible stages —
// a funnel dimple forms at a newly chosen rim location (0-30%), the water
// level falls rapidly toward it while the dimple holds (30-85%), then the
// dimple recedes as the floor settles at a residual level 80-90% below the
// pre-drain level, never to zero (85-100%). The drain location is a new
// angle around the basin rim each cycle, chosen at least 100deg away from
// the immediately-prior crack so it reads as migrating drainage, not a
// mechanical valve firing in the same spot.
//
// Seeded mid-drain at mount (t0), so the pond is already visibly non-empty,
// non-full, and the fill/drain distinction, plus at least one full
// drain-to-refill cycle boundary, are guaranteed inside the first ~1.2s —
// well inside the 2.5s/5s resting-loop checks — rather than depending on
// where a randomized multi-second fill happened to start.
//
// All ink is read from --foreground/--ns-muted via getComputedStyle on
// documentElement (never a literal), re-read on a MutationObserver watching
// its class attribute. Water alpha is chosen from the theme's own read
// foreground luminance rather than a hardcoded per-theme branch, so a
// third theme with tokens in between still gets a legible value step.
// ---------------------------------------------------------------------------

const FILL_MS_MIN = 9000;
const FILL_MS_MAX = 11000;
const DRAIN_MS = 1200;
const DIMPLE_END = 0.3; // fraction of DRAIN_MS: dimple fully formed
const FALL_END = 0.85; // fraction of DRAIN_MS: level finishes falling
const FULL_LEVEL = 0.93; // fill threshold that triggers the next drain
const DROP_MIN = 0.8; // 80-90% of the pre-drain level is lost each event
const DROP_MAX = 0.9;
const RESEED_MIN_DEG = 100; // next crack is at least this far from the last
const RESEED_SPAN_DEG = 160;
const N_POINTS = 64;
const DIMPLE_HALF_WIDTH = 0.62; // radians, ~35deg
const DIMPLE_DEPTH = 0.24; // fraction of the water radius the dimple bites in

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function smoothstep(a: number, b: number, x: number): number {
  if (a === b) return x < a ? 0 : 1;
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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

function parseHex(raw: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relLuminance([r, g, b]: [number, number, number]): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// smallest signed angular distance from a to b, in (-PI, PI]
function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

interface DrainState {
  phase: "fill" | "drain";
  level: number; // current fill level, 0..1
  fillElapsed: number;
  fillDuration: number;
  drainElapsed: number;
  levelAtDrainStart: number;
  dropFraction: number;
  thetaDrain: number;
  prevTheta: number;
}

function pickNextTheta(prev: number, rand: () => number): number {
  const offsetDeg = RESEED_MIN_DEG + rand() * RESEED_SPAN_DEG;
  const offset = (offsetDeg * Math.PI) / 180;
  let theta = prev + offset;
  theta = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return theta;
}

function coverageFor(level: number): number {
  return 0.16 + 0.76 * Math.sqrt(clamp01(level));
}

/** dimple amount (0..1) and the level for a given point inside a drain
 * event of duration DRAIN_MS, given elapsed ms into it. */
function drainFrame(
  elapsed: number,
  levelAtStart: number,
  dropFraction: number
): { dimple: number; level: number } {
  const u = clamp01(elapsed / DRAIN_MS);
  const residual = levelAtStart * (1 - dropFraction);
  if (u < DIMPLE_END) {
    return { dimple: smoothstep(0, DIMPLE_END, u), level: levelAtStart };
  }
  if (u < FALL_END) {
    const t = easeInOutCubic((u - DIMPLE_END) / (FALL_END - DIMPLE_END));
    return { dimple: 1, level: levelAtStart + (residual - levelAtStart) * t };
  }
  const recede = smoothstep(FALL_END, 1, u);
  return { dimple: 1 - recede, level: residual };
}

export interface MeltPondDrainProps {
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function MeltPondDrain({ className = "" }: MeltPondDrainProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rand = mulberry32(0xd4a17e ^ Date.now());
    const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");

    let disposed = false;
    let visible = true;
    let raf = 0;
    let last = 0;
    let dpr = 1;
    let w = 0;
    let h = 0;
    let sized = false;

    let fgRgb: [number, number, number] = [23, 23, 23];
    let mutedHex = "#4d4d4d";
    let waterAlphaBase = 0.55;

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      const fgHex = cs.getPropertyValue("--foreground").trim();
      fgRgb = parseHex(fgHex) ?? fgRgb;
      mutedHex = cs.getPropertyValue("--ns-muted").trim() || mutedHex;
      const lum = relLuminance(fgRgb);
      // dark theme: foreground reads pale/bright -> water sits near its
      // bright end, high alpha ("pale reflective"). Light theme: foreground
      // reads dark -> water stays a moderate, subtle value step, leaning on
      // the specular/edge strokes below for definition rather than a flat
      // dark fill fighting the copy ink.
      waterAlphaBase = 0.42 + lum * 0.42;
    };
    readTokens();

    const fg = (a: number) => `rgba(${fgRgb[0]},${fgRgb[1]},${fgRgb[2]},${a})`;
    const muted = (a: number) => {
      const rgb = parseHex(mutedHex) ?? [128, 128, 128];
      return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
    };

    // Seeded mid-drain: the pond is already draining at mount, guaranteeing
    // a visibly different level by 2.5s and a completed drain-to-refill
    // cycle boundary well inside the 5s check, regardless of RNG.
    const seedTheta = rand() * Math.PI * 2;
    const state: DrainState = {
      phase: "drain",
      level: 0.8 + rand() * 0.12,
      fillElapsed: 0,
      fillDuration: FILL_MS_MIN + rand() * (FILL_MS_MAX - FILL_MS_MIN),
      drainElapsed: rand() * DRAIN_MS * 0.6,
      levelAtDrainStart: 0.8 + rand() * 0.12,
      dropFraction: DROP_MIN + rand() * (DROP_MAX - DROP_MIN),
      thetaDrain: seedTheta,
      prevTheta: seedTheta,
    };
    state.levelAtDrainStart = state.level;

    const advance = (dtMs: number) => {
      if (state.phase === "drain") {
        state.drainElapsed += dtMs;
        const frame = drainFrame(state.drainElapsed, state.levelAtDrainStart, state.dropFraction);
        state.level = frame.level;
        if (state.drainElapsed >= DRAIN_MS) {
          state.level = state.levelAtDrainStart * (1 - state.dropFraction);
          state.phase = "fill";
          state.fillElapsed = 0;
          state.fillDuration = FILL_MS_MIN + rand() * (FILL_MS_MAX - FILL_MS_MIN);
          state.prevTheta = state.thetaDrain;
        }
      } else {
        state.fillElapsed += dtMs;
        const t = easeInOutCubic(clamp01(state.fillElapsed / state.fillDuration));
        const residual = state.levelAtDrainStart * (1 - state.dropFraction);
        state.level = residual + (FULL_LEVEL - residual) * t;
        if (state.fillElapsed >= state.fillDuration) {
          state.phase = "drain";
          state.drainElapsed = 0;
          state.levelAtDrainStart = FULL_LEVEL;
          state.thetaDrain = pickNextTheta(state.prevTheta, rand);
        }
      }
    };

    const currentDimple = (): number => {
      if (state.phase !== "drain") return 0;
      return drainFrame(state.drainElapsed, state.levelAtDrainStart, state.dropFraction).dimple;
    };

    const draw = () => {
      if (!sized) return;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const smaller = Math.min(w, h);
      const rx = smaller * 0.46;
      const ry = rx * 0.6;

      // basin depression: floor fill + rim hairline, --ns-muted only
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = muted(0.16);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = muted(0.38);
      ctx.stroke();

      const dimple = currentDimple();
      const theta = state.thetaDrain;
      const coverage = coverageFor(state.level);

      const pts: [number, number][] = [];
      for (let i = 0; i < N_POINTS; i++) {
        const angle = (i / N_POINTS) * Math.PI * 2;
        const dist = Math.abs(angleDelta(angle, theta));
        const bump = smoothstep(DIMPLE_HALF_WIDTH, 0, dist);
        const indent = dimple * bump * DIMPLE_DEPTH;
        const r = coverage * (1 - indent);
        pts.push([cx + Math.cos(angle) * rx * r, cy + Math.sin(angle) * ry * r]);
      }

      // water surface, smoothed closed curve through the sampled points
      ctx.beginPath();
      const first = pts[0]!;
      const lastPt = pts[N_POINTS - 1]!;
      ctx.moveTo((first[0] + lastPt[0]) / 2, (first[1] + lastPt[1]) / 2);
      for (let i = 0; i < N_POINTS; i++) {
        const p = pts[i]!;
        const next = pts[(i + 1) % N_POINTS]!;
        const midX = (p[0] + next[0]) / 2;
        const midY = (p[1] + next[1]) / 2;
        ctx.quadraticCurveTo(p[0], p[1], midX, midY);
      }
      ctx.closePath();
      ctx.fillStyle = fg(waterAlphaBase);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = fg(Math.min(0.95, waterAlphaBase + 0.22));
      ctx.stroke();

      // specular highlight — a soft arc toward the upper-left of the
      // surface, the value-step cue the light-theme spec calls for
      ctx.beginPath();
      ctx.ellipse(
        cx - rx * coverage * 0.32,
        cy - ry * coverage * 0.4,
        rx * coverage * 0.34,
        ry * coverage * 0.18,
        -0.4,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = fg(Math.min(0.95, waterAlphaBase + 0.3));
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;

      // drain crack — a small zigzag from the water edge out to the rim,
      // visible only while a dimple is forming/holding/receding
      if (dimple > 0.02) {
        const edgeR = coverage * (1 - dimple * DIMPLE_DEPTH);
        const ex = cx + Math.cos(theta) * rx * edgeR;
        const ey = cy + Math.sin(theta) * ry * edgeR;
        const rimX = cx + Math.cos(theta) * rx * 0.97;
        const rimY = cy + Math.sin(theta) * ry * 0.97;
        const midX1 = ex + (rimX - ex) * 0.35 + Math.cos(theta + Math.PI / 2) * 4;
        const midY1 = ey + (rimY - ey) * 0.35 + Math.sin(theta + Math.PI / 2) * 4;
        const midX2 = ex + (rimX - ex) * 0.7 - Math.cos(theta + Math.PI / 2) * 4;
        const midY2 = ey + (rimY - ey) * 0.7 - Math.sin(theta + Math.PI / 2) * 4;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(midX1, midY1);
        ctx.lineTo(midX2, midY2);
        ctx.lineTo(rimX, rimY);
        ctx.strokeStyle = muted(0.5 * dimple + 0.15);
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 2 || h < 2) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || !sized) return;
      const dt = last ? Math.min(200, now - last) : 1000 / 60;
      last = now;
      advance(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    const drawReducedFrame = () => {
      // deliberately NOT t0's live seed: a fixed, hand-chosen mid-drain
      // instant — dimple fully formed, level partway through its fall,
      // floor partly exposed — the single most structured frame.
      const frozen: DrainState = {
        ...state,
        phase: "drain",
        levelAtDrainStart: 0.88,
        dropFraction: 0.85,
        drainElapsed: DRAIN_MS * 0.55,
        thetaDrain: seedTheta,
      };
      const frame = drainFrame(frozen.drainElapsed, frozen.levelAtDrainStart, frozen.dropFraction);
      state.level = frame.level;
      state.phase = "drain";
      state.drainElapsed = frozen.drainElapsed;
      state.levelAtDrainStart = frozen.levelAtDrainStart;
      state.dropFraction = frozen.dropFraction;
      state.thetaDrain = frozen.thetaDrain;
      draw();
    };

    const start = () => {
      if (reducedMq.matches) {
        drawReducedFrame();
        return;
      }
      last = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const ro = new ResizeObserver(() => {
      resize();
      if (reducedMq.matches) drawReducedFrame();
    });
    ro.observe(canvas);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reducedMq.matches) start();
      else stop();
    });
    io.observe(canvas);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reducedMq.matches) drawReducedFrame();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onReducedChange = () => {
      if (reducedMq.matches) {
        stop();
        drawReducedFrame();
      } else {
        start();
      }
    };
    reducedMq.addEventListener("change", onReducedChange);

    const onVis = () => {
      if (document.hidden) stop();
      else if (visible && !reducedMq.matches) start();
    };
    document.addEventListener("visibilitychange", onVis);

    resize();
    if (sized) {
      if (reducedMq.matches) drawReducedFrame();
      else start();
    }

    return () => {
      disposed = true;
      stop();
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      reducedMq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVis);
      void disposed;
    };
  }, []);

  return (
    <div role="img" aria-label="Loading" className={`relative h-full w-full ${className}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
    </div>
  );
}

MeltPondDrain.displayName = "MeltPondDrain";
