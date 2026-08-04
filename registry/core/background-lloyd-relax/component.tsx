"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// LloydRelax — a blue-noise stipple screen that never finishes settling.
//
// Every frame runs exactly ONE iteration of weighted Lloyd relaxation against a
// drifting density function. Lloyd's algorithm moves each site toward the
// centroid of its own Voronoi cell; its fixed point is a centroidal Voronoi
// tessellation, whose local spacing goes as rho^(-1/2). That is the reason the
// field reads as an engraved tonal screen rather than scattered noise — the
// dots are not randomly placed, they are the stationary distribution of a
// relaxation, so they are locally equidistant everywhere while still being
// globally denser where rho is larger.
//
// The density has GENUINE ZEROS: rho = clamp((n - 0.35)/0.65, 0, 1)^2 with n a
// sum of three sines. The 0.35 floor leaves roughly a quarter of the frame at
// exactly zero, and the square makes the falloff steep, so ink pools into a few
// lobes with hard-edged bare paper between them instead of washing evenly over
// the frame. The three sine periods (~30s, ~42s, ~57s) are mutually
// incommensurate, so the lobes drift and reshape forever and the relaxation
// never converges — that non-convergence IS the resting pulse. There is no
// separate ambient animation layered on top.
//
// The Voronoi cell is never triangulated. Sites are binned into a uniform hash
// grid; a quarter-resolution sample lattice walks the frame, each sample finds
// its nearest site by scanning only the 3x3 neighbouring bins, and accumulates
// its own rho into that site's weight/moment accumulators. That is the discrete
// weighted Voronoi centroid — the Delaunay dual computed without ever building
// a triangulation.
//
// The pointer multiplies the density by a gaussian well. Nothing pulls the dots
// directly: the relaxation itself carries them inward over about a second
// because their cells' centroids have moved, and lets them drain back out at
// the same rate once the well eases shut.
// ---------------------------------------------------------------------------

const HASH_CELL = 48; // px — uniform site hash bin
const SAMPLE_CELL = 6; // px — quarter-resolution centroid sample lattice
const STEP = 0.55; // fraction of the way to the centroid, per iteration
const DEAD_W = 1e-4; // sumW below this = stranded in a zero region, teleport
const DOT_R = 1.5; // px
const ALPHAS = [0.22, 0.4, 0.58, 0.76, 0.95] as const;
const CULL_RHO = 0.02; // below this the point is not drawn at all
const WELL_GAIN = 2.6; // peak density multiplier under the pointer
const WELL_SIGMA = 90; // px
const WELL_TAU = 0.5; // s — well opens and closes on the same constant
const SEED_TRIES = 40;
const WARM_MOUNT = 12; // iterations run at (re)size so frame one is settled
const WARM_ITERS = 24; // reduced-motion: iterations run before the one frame
const DT_MAX = 1 / 30;
const SEED = 0x10ddd1;

/** deterministic PRNG so a given size always seeds the same field */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ambient density. Three incommensurate sines, floored at 0.35 so about a
 * quarter of the frame is exactly zero, then squared for a steep edge.
 */
function ambient(x: number, y: number, t: number): number {
  const n =
    0.5 +
    (Math.sin(0.0091 * x + 0.21 * t) +
      Math.sin(0.0067 * y - 0.15 * t) +
      Math.sin(0.0053 * (x + y) + 0.11 * t)) /
      6;
  let r = (n - 0.35) / 0.65;
  if (r <= 0) return 0;
  if (r > 1) r = 1;
  return r * r;
}

export interface LloydRelaxProps {
  /** number of stipple sites */
  count?: number;
  className?: string;
}

export function LloydRelax({ count = 1400, className = "" }: LloydRelaxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const n = Math.max(64, Math.round(count));
    let rng = mulberry32(SEED);

    let fg = "currentColor";
    let width = 0;
    let height = 0;
    let sized = false;
    let disposed = false;

    // site state — mutated in place, never reallocated on the hot path
    const px = new Float32Array(n);
    const py = new Float32Array(n);
    const sumW = new Float32Array(n);
    const sumWX = new Float32Array(n);
    const sumWY = new Float32Array(n);
    const next = new Int32Array(n);
    let heads = new Int32Array(0);
    let hCols = 0;
    let hRows = 0;

    const buckets: number[][] = Array.from({ length: ALPHAS.length }, () => []);

    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
    };

    /** rejection-sample a position against the ambient density at time t */
    const place = (i: number, t: number) => {
      for (let k = 0; k < SEED_TRIES; k++) {
        const x = rng() * width;
        const y = rng() * height;
        if (rng() < ambient(x, y, t)) {
          px[i] = x;
          py[i] = y;
          return;
        }
      }
      px[i] = rng() * width;
      py[i] = rng() * height;
    };

    const seed = () => {
      // restart the stream so a given size always seeds the same field, even
      // after a resize has already drawn from it
      rng = mulberry32(SEED);
      for (let i = 0; i < n; i++) place(i, 0);
    };

    /** one weighted Lloyd iteration */
    const relax = (t: number, wx: number, wy: number, ws: number) => {
      // (1) rebuild the site hash in place
      heads.fill(-1);
      for (let i = 0; i < n; i++) {
        let cx = (px[i]! / HASH_CELL) | 0;
        let cy = (py[i]! / HASH_CELL) | 0;
        if (cx < 0) cx = 0;
        else if (cx >= hCols) cx = hCols - 1;
        if (cy < 0) cy = 0;
        else if (cy >= hRows) cy = hRows - 1;
        const c = cy * hCols + cx;
        next[i] = heads[c]!;
        heads[c] = i;
      }

      sumW.fill(0);
      sumWX.fill(0);
      sumWY.fill(0);

      // (2) walk the sample lattice, accumulate the weighted Voronoi centroid
      const sCols = Math.ceil(width / SAMPLE_CELL);
      const sRows = Math.ceil(height / SAMPLE_CELL);
      const wellActive = ws > 0.01;
      const inv2s2 = 1 / (2 * WELL_SIGMA * WELL_SIGMA);
      for (let sy = 0; sy < sRows; sy++) {
        const y = sy * SAMPLE_CELL + SAMPLE_CELL / 2;
        const by = (y / HASH_CELL) | 0;
        for (let sx = 0; sx < sCols; sx++) {
          const x = sx * SAMPLE_CELL + SAMPLE_CELL / 2;
          let w = ambient(x, y, t);
          if (wellActive) {
            const dx = x - wx;
            const dy = y - wy;
            w *= 1 + ws * WELL_GAIN * Math.exp(-(dx * dx + dy * dy) * inv2s2);
          }
          if (w <= 0) continue; // the zero regions cost nothing

          const bx = (x / HASH_CELL) | 0;
          let best = -1;
          let bestQ = Infinity;
          const y0 = by > 0 ? by - 1 : 0;
          const y1 = by + 1 < hRows ? by + 1 : hRows - 1;
          const x0 = bx > 0 ? bx - 1 : 0;
          const x1 = bx + 1 < hCols ? bx + 1 : hCols - 1;
          for (let cy = y0; cy <= y1; cy++) {
            const row = cy * hCols;
            for (let cx = x0; cx <= x1; cx++) {
              for (let i = heads[row + cx]!; i !== -1; i = next[i]!) {
                const dx = x - px[i]!;
                const dy = y - py[i]!;
                const q = dx * dx + dy * dy;
                if (q < bestQ) {
                  bestQ = q;
                  best = i;
                }
              }
            }
          }
          if (best === -1) continue;
          sumW[best] += w;
          sumWX[best] += w * x;
          sumWY[best] += w * y;
        }
      }

      // (3) step toward the centroid, or teleport out of a dead zone
      for (let i = 0; i < n; i++) {
        const sw = sumW[i]!;
        if (sw < DEAD_W) {
          place(i, t);
          continue;
        }
        const cx = sumWX[i]! / sw;
        const cy = sumWY[i]! / sw;
        let x = px[i]! + (cx - px[i]!) * STEP;
        let y = py[i]! + (cy - py[i]!) * STEP;
        if (x < 0) x = 0;
        else if (x > width) x = width;
        if (y < 0) y = 0;
        else if (y > height) y = height;
        px[i] = x;
        py[i] = y;
      }
    };

    const draw = (t: number, wx: number, wy: number, ws: number) => {
      if (!sized) return;
      ctx.clearRect(0, 0, width, height);
      for (let b = 0; b < buckets.length; b++) buckets[b]!.length = 0;

      const wellActive = ws > 0.01;
      const inv2s2 = 1 / (2 * WELL_SIGMA * WELL_SIGMA);
      for (let i = 0; i < n; i++) {
        const x = px[i]!;
        const y = py[i]!;
        let r = ambient(x, y, t);
        if (wellActive) {
          const dx = x - wx;
          const dy = y - wy;
          r *= 1 + ws * WELL_GAIN * Math.exp(-(dx * dx + dy * dy) * inv2s2);
        }
        if (r < CULL_RHO) continue;
        if (r > 1) r = 1;
        let b = (r * ALPHAS.length) | 0;
        if (b >= ALPHAS.length) b = ALPHAS.length - 1;
        buckets[b]!.push(i);
      }

      ctx.fillStyle = fg;
      for (let b = 0; b < ALPHAS.length; b++) {
        const list = buckets[b]!;
        if (list.length === 0) continue;
        ctx.globalAlpha = ALPHAS[b]!;
        ctx.beginPath();
        for (let k = 0; k < list.length; k++) {
          const i = list[k]!;
          ctx.moveTo(px[i]! + DOT_R, py[i]!);
          ctx.arc(px[i]!, py[i]!, DOT_R, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      hCols = Math.max(1, Math.ceil(width / HASH_CELL));
      hRows = Math.max(1, Math.ceil(height / HASH_CELL));
      heads = new Int32Array(hCols * hRows);
      seed();
      sized = true;
      // warm the field so the very first painted frame is already a settled
      // stipple screen rather than the raw rejection-sampled scatter
      for (let k = 0; k < WARM_MOUNT; k++) relax(0, 0, 0, 0);
    };

    /** reduced motion: settle synchronously, then draw exactly one frame */
    const still = () => {
      if (!sized) return;
      for (let k = 0; k < WARM_ITERS; k++) relax(0, 0, 0, 0);
      draw(0, 0, 0, 0);
    };

    // -- hot-path state -------------------------------------------------------
    let raf = 0;
    let last = 0;
    let t = 0;
    const ptr = { x: 0, y: 0, has: false, s: 0 };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      const target = ptr.has ? 1 : 0;
      ptr.s += (target - ptr.s) * Math.min(1, dt / WELL_TAU);
      if (sized) {
        relax(t, ptr.x, ptr.y, ptr.s);
        draw(t, ptr.x, ptr.y, ptr.s);
      }
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ptr.x = e.clientX - rect.left;
      ptr.y = e.clientY - rect.top;
      ptr.has = true;
    };
    const onPointerLeave = () => {
      ptr.has = false;
    };

    const onVis = () => {
      if (!document.hidden && !reduced) {
        last = 0;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      }
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(0, 0, 0, 0);
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    let lastW = 0;
    let lastH = 0;
    const ro = new ResizeObserver(() => {
      if (disposed) return;
      const rect = canvas.getBoundingClientRect();
      if (
        Math.abs(rect.width - lastW) < 4 &&
        Math.abs(rect.height - lastH) < 4
      ) {
        return;
      }
      lastW = rect.width;
      lastH = rect.height;
      resize();
      if (reduced) still();
    });
    ro.observe(canvas);

    readTokens();
    resize();
    lastW = width;
    lastH = height;
    if (reduced) {
      still();
    } else {
      raf = requestAnimationFrame(loop);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerleave", onPointerLeave);
      document.addEventListener("visibilitychange", onVis);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      mo.disconnect();
      ro.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`block h-full w-full text-foreground ${className}`}
    />
  );
}
