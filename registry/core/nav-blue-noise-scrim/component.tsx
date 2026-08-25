"use client";

import { useLayoutEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// NavBlueNoiseScrim — the dimming backdrop behind a command palette / search
// overlay, rendered as a TEMPORAL blue-noise dither instead of a flat tint.
//
// Spatial mask: a real void-and-cluster point distribution (Ulichney 1993),
// computed once per matrix size. Unlike the repo's ordered-dither family
// (background-ascii-dither's Bayer mode, chart-*-dither), which threshold
// against a small regular 4x4 matrix and read as a visible crosshatch at any
// zoom, void-and-cluster iteratively balances a binary pattern against its
// own Gaussian-blurred energy so no two "on" cells ever cluster and no
// region goes empty for long — an aperiodic, non-repeating-looking point set
// with no dominant frequency. That produces a RANK for every cell in the
// matrix (0..N-1): thresholding "rank < coverage * N" at any coverage level
// yields a blue-noise-distributed dot set, which is the mechanism ordered
// dithering is built on but with a fundamentally different point-generation
// algorithm and a different visual signature (fine, grain-like, isotropic —
// not a lattice).
//
// Temporal reshuffle: real-time renderers get "temporal blue noise" by
// pairing a spatial blue-noise mask with a decorrelated per-frame offset
// (the animated-noise / golden-ratio-sequence trick used for TAA dithering,
// e.g. Playdead's INSIDE, Jorge Jimenez's "Interleaved Gradient Noise").
// Every rAF tick we advance a frame-offset by the golden-ratio conjugate mod
// 1 and threshold `frac(rank / N + offset) < coverage` — every cell cycles
// through the full rank order over N frames, decorrelated frame to frame,
// so which dots are lit changes completely each frame while the SPATIAL
// distribution of "on" cells stays blue-noise at every instant. This is an
// honest approximation of full spatiotemporal blue noise (STBN, which needs
// a pre-baked 3D noise volume) built from one 2D void-and-cluster mask, not
// a from-scratch spatiotemporal solve.
// ---------------------------------------------------------------------------

const MATRIX_SIZE = 32; // 1024-cell void-and-cluster tile
const GOLDEN_CONJUGATE = 0.6180339887498949;

// module-level cache: the matrix is expensive-ish (O(n^2) balancing passes)
// and fully deterministic for a fixed size, so every mounted instance shares
// one computation instead of repeating it per scrim.
let cachedRanks: Uint32Array | null = null;

function computeVoidClusterRanks(size: number): Uint32Array {
  const n = size * size;
  const R = 2; // filter radius (5x5 support)
  const sigma = 1.5;
  const kernel: number[] = [];
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      kernel.push(Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)));
    }
  }
  const idx = (x: number, y: number) =>
    ((y + size) % size) * size + ((x + size) % size);

  const addEnergy = (
    energy: Float32Array,
    x: number,
    y: number,
    sign: number
  ) => {
    let k = 0;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        energy[idx(x + dx, y + dy)] += sign * kernel[k++];
      }
    }
  };

  const tightestCluster = (pattern: Uint8Array, energy: Float32Array) => {
    let best = -1;
    let bestE = -Infinity;
    for (let i = 0; i < n; i++) {
      if (pattern[i] === 1 && energy[i] > bestE) {
        bestE = energy[i];
        best = i;
      }
    }
    return best;
  };
  const largestVoid = (pattern: Uint8Array, energy: Float32Array) => {
    let best = -1;
    let bestE = Infinity;
    for (let i = 0; i < n; i++) {
      if (pattern[i] === 0 && energy[i] < bestE) {
        bestE = energy[i];
        best = i;
      }
    }
    return best;
  };

  // deterministic seed so the mask is stable across reloads/screenshots
  let seed = 0x9e3779b9;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const pattern = new Uint8Array(n);
  const energy = new Float32Array(n);
  const initialCount = Math.max(2, Math.round(n * 0.1));
  const ones = new Set<number>();
  while (ones.size < initialCount) ones.add(Math.floor(rand() * n));
  for (const i of ones) {
    pattern[i] = 1;
    addEnergy(energy, i % size, Math.floor(i / size), 1);
  }

  // Phase 1 — balance the initial pattern: swap the tightest cluster for the
  // largest void until a swap would just reverse itself (converged).
  for (let iter = 0; iter < initialCount * 4; iter++) {
    const cluster = tightestCluster(pattern, energy);
    pattern[cluster] = 0;
    addEnergy(energy, cluster % size, Math.floor(cluster / size), -1);
    const voidCell = largestVoid(pattern, energy);
    if (voidCell === cluster) {
      pattern[cluster] = 1;
      addEnergy(energy, cluster % size, Math.floor(cluster / size), 1);
      break;
    }
    pattern[voidCell] = 1;
    addEnergy(energy, voidCell % size, Math.floor(voidCell / size), 1);
  }

  const ranks = new Uint32Array(n);
  const balancedCount = pattern.reduce((a, b) => a + b, 0);
  // snapshot the converged, balanced pattern before phase 2 consumes it —
  // phase 3 restarts from this exact state rather than re-deriving it.
  const p3 = pattern.slice();
  const e3 = energy.slice();

  // Phase 2 — rank the balanced ones downward (n0-1 .. 0): repeatedly strip
  // the tightest cluster, so the most-clustered cell gets the lowest rank
  // and empties first as coverage shrinks.
  const p2 = pattern;
  const e2 = energy;
  let rank = balancedCount - 1;
  while (rank >= 0) {
    const cluster = tightestCluster(p2, e2);
    p2[cluster] = 0;
    addEnergy(e2, cluster % size, Math.floor(cluster / size), -1);
    ranks[cluster] = rank;
    rank--;
  }

  // Phase 3 — rank the remaining zeros upward (n0 .. N-1) from the snapshot
  // of the balanced pattern: repeatedly fill the largest void, so cells fill
  // in the order that keeps the pattern most evenly spread at every coverage.
  rank = balancedCount;
  while (rank < n) {
    const voidCell = largestVoid(p3, e3);
    p3[voidCell] = 1;
    addEnergy(e3, voidCell % size, Math.floor(voidCell / size), 1);
    ranks[voidCell] = rank;
    rank++;
  }

  return ranks;
}

export interface NavBlueNoiseScrimProps {
  /** grain cell size in px — kept fine and proportional, never a coarse checkerboard */
  cellSize?: number;
  /** mean fraction of cells lit at any instant, 0..1 */
  coverage?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function NavBlueNoiseScrim({
  cellSize = 4,
  coverage = 0.07,
  className = "",
}: NavBlueNoiseScrimProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // token derive happens in useLayoutEffect, before first paint, so no rAF /
  // ResizeObserver / reduced-motion branch can draw with an empty ink string
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let bg = "";
    let fg = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = cs.getPropertyValue("--background").trim();
      fg = cs.getPropertyValue("--foreground").trim();
    };
    readTokens();

    if (!cachedRanks) cachedRanks = computeVoidClusterRanks(MATRIX_SIZE);
    const ranks = cachedRanks;
    const n = MATRIX_SIZE * MATRIX_SIZE;

    let dpr = 1;
    let cols = 0;
    let rows = 0;
    let cssW = 0;
    let cssH = 0;
    let raf = 0;
    let frame = 0;
    let disposed = false;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      cssW = rect.width;
      cssH = rect.height;
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      cols = Math.ceil(cssW / cellSize);
      rows = Math.ceil(cssH / cellSize);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw(0);
      }, 100);
    });
    ro.observe(canvas);

    // base dim: a controlled, flat --background wash so the scrim reads as
    // "behind the dialog" even where no grain cell lands this frame — the
    // grain is texture on TOP of legibility, not the source of it. The
    // dialog panel itself (see demo) is fully opaque, so nothing drawn here
    // ever touches its text regardless of coverage or alpha.
    const BASE_DIM_ALPHA = 0.55;
    const GRAIN_ALPHA = 0.5;

    const draw = (offset: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = bg;
      ctx.globalAlpha = BASE_DIM_ALPHA;
      ctx.fillRect(0, 0, cssW, cssH);

      ctx.fillStyle = fg;
      ctx.globalAlpha = GRAIN_ALPHA;
      for (let gy = 0; gy < rows; gy++) {
        const my = gy % MATRIX_SIZE;
        for (let gx = 0; gx < cols; gx++) {
          const mx = gx % MATRIX_SIZE;
          const rank = ranks[my * MATRIX_SIZE + mx];
          const t = (rank / n + offset) % 1;
          if (t < coverage) {
            ctx.fillRect(gx * cellSize, gy * cellSize, cellSize, cellSize);
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      frame++;
      const offset = (frame * GOLDEN_CONJUGATE) % 1;
      draw(offset);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onVis = () => {
      if (!document.hidden && !reduced) {
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // theme flip re-reads tokens live; frozen reduced-motion frame repaints
    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(0);
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    document.fonts.ready.then(() => {
      if (disposed) return;
      resize();
      if (reduced) {
        // prefers-reduced-motion: freeze to a single static blue-noise mask
        // instance (offset 0) rather than reshuffling every frame — still
        // aperiodic and still distinct from Bayer, just not animated. A
        // per-frame reshuffling grain is exactly the kind of motion this
        // media query exists to suppress.
        draw(0);
      } else {
        raf = requestAnimationFrame(loop);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellSize, coverage]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none block h-full w-full ${className}`}
    />
  );
}
