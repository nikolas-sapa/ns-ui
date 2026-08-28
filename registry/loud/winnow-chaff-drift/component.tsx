"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// WinnowChaffDrift — a full-bleed hero built on a real grain-cleaning
// mechanic: winnowing. A mixed charge of grain and chaff is dropped through a
// steady crosswind. Grain is heavy enough that momentum wins over drag and it
// falls in a near-vertical column; chaff is light enough that the wind wins
// and it is carried laterally, fanning out before it lands. Nothing here
// "explains" which population is which with colour — the separation reads
// entirely from trajectory (straight vs. fanned) and softness (a hard-edged
// disc vs. a soft radial fleck), the honest luminance analogue of "light
// enough to be blown."
//
// TWO POPULATIONS, TWO PHYSICS MODELS. Grain gets a tiny, per-particle,
// wind-independent lateral velocity assigned once at spawn (mass dominates,
// so the wind barely touches it — this is why the column stays tight and
// centred through every gust phase, the invariant that sells the whole
// component). Chaff's lateral velocity is read continuously from the local
// wind field and scaled by a drag coefficient, so it visibly answers every
// gust change as it falls.
//
// THE WIND FIELD is a coarse 1D lattice of cells across the container's
// smaller-dimension-derived width, each holding a slowly-interpolated local
// noise value (regenerated at 2Hz, well under paint rate — a faster update
// reads as jitter, not gust texture) layered under one slow global sine gust
// (9s period). No per-particle noise: every chaff particle at the same x
// answers the same field, which is what makes the fan read as one coherent
// gust rather than N independent flecks.
// ---------------------------------------------------------------------------

type Vec3 = [number, number, number];

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

function relLuminance([r, g, b]: Vec3): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// -- real numbers (documented in the spec, not exposed as props: this
// specific mechanical character IS the component) --------------------------
const SPAWN_RATE = 6; // particles/s
const GRAIN_FRACTION = 0.65;
const GRAIN_RADIUS_MIN = 2;
const GRAIN_RADIUS_MAX = 3;
const GRAIN_FALL_SPEED = 180; // px/s
const GRAIN_DRIFT_MAX = 8; // total px of lateral travel over the full fall
const CHAFF_RADIUS_MIN = 4;
const CHAFF_RADIUS_MAX = 7;
const CHAFF_FALL_SPEED = 45; // px/s
const CHAFF_DRIFT_COEF = 0.85; // fraction of local wind the chaff answers
const WIND_CELL_PX = 24;
const NOISE_UPDATE_S = 0.5; // 2Hz cell target refresh
const NOISE_AMP = 20; // px/s local gust texture
const GUST_PERIOD_S = 9; // s per full sine gust cycle
const GUST_AMP = 40; // px/s
const DESPAWN_MARGIN = 40; // px past whichever edge a particle exits
const DPR_CAP = 1.5;
// Reduced-motion freeze: a gust extremum (peak lateral wind, not a
// zero-crossing) reached well after the standing chaff population has fully
// saturated the frame (chaff lifetime ~ containerHeight / 45px/s, so several
// gust periods in guarantees saturation regardless of viewport height).
// sin() peaks at T/4 + n*T; the third peak (20.25s) clears both bars.
const STATIC_TIME_S = 20.25;

interface Particle {
  x: number;
  y: number;
  radius: number;
  fallSpeed: number;
  type: "grain" | "chaff";
  grainDriftVx: number; // grain only: fixed at spawn
}

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

export interface WinnowChaffDriftProps {
  /** content rendered over the field, e.g. a headline + CTA */
  children?: React.ReactNode;
  className?: string;
}

export function WinnowChaffDrift({
  children,
  className = "",
}: WinnowChaffDriftProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // -- token-derived ink, read at mount and re-derived on theme flip ------
    let bg: Vec3 = [10, 10, 10];
    let fg: Vec3 = [237, 237, 237];
    let grainAlpha = 0.7;
    let chaffAlpha = 0.4;
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = parseColor(cs.getPropertyValue("--background")) ?? bg;
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
      // Light theme is the harder case for the soft chaff fleck: bump its
      // opacity so it holds >=3:1 against a pale background instead of
      // washing out at the same alpha that reads fine on a dark ground.
      const light = relLuminance(bg) > 0.5;
      chaffAlpha = light ? 0.5 : 0.4;
      grainAlpha = 0.7;
    };
    derive();

    // -- hot-path state: locals only, never React state ---------------------
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = 0;
    let paused = false;
    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let simTime = 0;
    let spawnAccumulator = 0;
    let particles: Particle[] = [];
    let rand = Math.random;

    // -- wind lattice: cellCount cells across the container's smaller
    // dimension, each a slowly-interpolated local noise value ---------------
    let cellCount = 1;
    let cellCur: number[] = [0];
    let cellNext: number[] = [0];
    let cellPhase = 0; // 0..1 within the current NOISE_UPDATE_S window

    const rebuildCells = () => {
      cellCount = Math.max(1, Math.floor(Math.min(w, h) / WIND_CELL_PX));
      cellCur = new Array(cellCount).fill(0).map(() => (rand() * 2 - 1) * NOISE_AMP);
      cellNext = new Array(cellCount).fill(0).map(() => (rand() * 2 - 1) * NOISE_AMP);
      cellPhase = 0;
    };

    const stepWindCells = (dt: number) => {
      cellPhase += dt / NOISE_UPDATE_S;
      while (cellPhase >= 1) {
        cellPhase -= 1;
        cellCur = cellNext;
        cellNext = cellCur.map(() => (rand() * 2 - 1) * NOISE_AMP);
      }
    };

    const windAt = (x: number, t: number) => {
      const gust = Math.sin((t / GUST_PERIOD_S) * Math.PI * 2) * GUST_AMP;
      const idx = Math.min(
        cellCount - 1,
        Math.max(0, Math.floor((x / Math.max(1, w)) * cellCount))
      );
      const local = cellCur[idx]! + (cellNext[idx]! - cellCur[idx]!) * cellPhase;
      return gust + local;
    };

    const spawn = () => {
      const isGrain = rand() < GRAIN_FRACTION;
      if (isGrain) {
        const fallDur = h / GRAIN_FALL_SPEED;
        const vxMax = fallDur > 0 ? GRAIN_DRIFT_MAX / fallDur : 0;
        particles.push({
          x: rand() * w,
          y: -10,
          radius: GRAIN_RADIUS_MIN + rand() * (GRAIN_RADIUS_MAX - GRAIN_RADIUS_MIN),
          fallSpeed: GRAIN_FALL_SPEED,
          type: "grain",
          grainDriftVx: (rand() * 2 - 1) * vxMax,
        });
      } else {
        particles.push({
          x: rand() * w,
          y: -10,
          radius: CHAFF_RADIUS_MIN + rand() * (CHAFF_RADIUS_MAX - CHAFF_RADIUS_MIN),
          fallSpeed: CHAFF_FALL_SPEED,
          type: "chaff",
          grainDriftVx: 0,
        });
      }
    };

    const step = (dt: number) => {
      simTime += dt;
      stepWindCells(dt);

      spawnAccumulator += dt * SPAWN_RATE;
      while (spawnAccumulator >= 1) {
        spawnAccumulator -= 1;
        spawn();
      }

      const next: Particle[] = [];
      for (const p of particles) {
        if (p.type === "grain") {
          p.x += p.grainDriftVx * dt;
        } else {
          p.x += windAt(p.x, simTime) * CHAFF_DRIFT_COEF * dt;
        }
        p.y += p.fallSpeed * dt;
        const offBottom = p.y - p.radius > h + DESPAWN_MARGIN;
        const offSide = p.x < -DESPAWN_MARGIN || p.x > w + DESPAWN_MARGIN;
        if (!offBottom && !offSide) next.push(p);
      }
      particles = next;
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        if (p.type === "grain") {
          ctx.fillStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},${grainAlpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
          grad.addColorStop(0, `rgba(${fg[0]},${fg[1]},${fg[2]},${chaffAlpha})`);
          grad.addColorStop(1, `rgba(${fg[0]},${fg[1]},${fg[2]},0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const renderStatic = () => {
      // deterministic replay up to STATIC_TIME_S, then stop — the frame
      // never changes again, satisfying the reduced-motion byte-stability
      // check.
      rand = mulberry32(20260827);
      particles = [];
      simTime = 0;
      spawnAccumulator = 0;
      rebuildCells();
      const stepDt = 1 / 60;
      let t = 0;
      while (t < STATIC_TIME_S) {
        const d = Math.min(stepDt, STATIC_TIME_S - t);
        step(d);
        t += d;
      }
      draw();
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, last === 0 ? 1 / 60 : (now - last) / 1000);
      last = now;
      step(dt);
      draw();
    };

    const rafLoop = (now: number) => {
      frame(now);
      if (!paused) raf = requestAnimationFrame(rafLoop);
    };

    const stopLoop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };

    const startLoop = () => {
      stopLoop();
      if (paused) return;
      if (reduced) {
        renderStatic();
        return;
      }
      rand = Math.random;
      particles = [];
      simTime = 0;
      spawnAccumulator = 0;
      rebuildCells();
      raf = requestAnimationFrame(rafLoop);
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      startLoop();
    };

    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const onThemeChange = () => derive();
    const mo = new MutationObserver(onThemeChange);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    colorScheme.addEventListener("change", onThemeChange);

    const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReducedChange = () => {
      reduced = reducedMq.matches;
      startLoop();
    };
    reducedMq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      paused = document.hidden;
      if (paused) stopLoop();
      else startLoop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let io: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        paused = !entry.isIntersecting || document.hidden;
        if (paused) stopLoop();
        else startLoop();
      });
      io.observe(root);
    }

    return () => {
      stopLoop();
      ro.disconnect();
      mo.disconnect();
      colorScheme.removeEventListener("change", onThemeChange);
      reducedMq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative h-full w-full overflow-hidden bg-background ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {children}
    </div>
  );
}
