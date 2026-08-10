"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// KamaciteEtch — a full-bleed ASCII Widmanstätten pattern: the interlocking
// kamacite lath structure an acid etch reveals on a polished nickel-iron
// meteorite slice. No simulation runs per frame; everything that varies over
// time is a closed-form function of precomputed per-cell data, evaluated
// fresh every frame.
//
// LATTICE (built once per resize): four lath-family orientations are derived
// from the octahedral dihedral angle, acos(1/3) = 70.5288deg — the angle
// between the normals of any two adjacent {111} faces of the parent taenite
// octahedron, so the four in-plane directions this pattern locks to are the
// same four a real cut-and-etched octahedrite shows. Each family gets its
// own set of parallel boundary lines (irregular spacing = uneven lath
// thickness, still dead straight) built by projecting the canvas corners
// onto that family's normal. Per cell, per family, a binary search finds the
// enclosing band and how deep into it the cell sits (1 = band centre, 0 = at
// a wall). The family with the DEEPEST local interior — not nearest-line,
// deepest-interior — owns the cell; that argmax across four independent
// roughly-uniform residuals splits the plane close to evenly and produces a
// genuine interlocking parallelogram tiling at fixed angles, not a Voronoi
// cell wall network (that shape belongs to background-ascii-voronoi-walls)
// and not an organic grown boundary (background-ascii-domain-walls).
//
// ETCH FRONT (per frame, per cell): a single scalar delta = frontPos - s,
// where s is the cell's position along a diagonal sweep axis independent of
// the lattice angles (the physical bath direction, not a crystal direction)
// and frontPos grows without bound at 1 s-unit per SWEEP_SECONDS. Taking
// delta modulo one cycle width turns that unbounded growth into a periodic
// rise -> idle -> fall pulse per cell: rises from 0 to 1 as the front first
// reaches it (surfacing out of blank metal), holds at exactly 1 through a
// long idle interior (fully etched), then eases back to 0 (repolished) well
// before the front would need to "jump" back to the start — so the loop
// point is a region that has already faded to blank, not a visible reset.
// Cell brightness is developed * a per-cell contrast baked in at build time
// (per-band hash + a boost near the cell's own family boundary, so
// interlocking seams read a little brighter, like a grain boundary catching
// the etch). Cells whose developed value is EXACTLY 1 (the idle interior,
// not the ramps) add a small per-band sinusoidal shimmer phased along that
// band's own axis, so the shimmer appears to travel down the lath's length.
//
// GLYPH: above a faint-cutoff the glyph is the owning family's slash
// character (-, |, \, /, one per family, chosen by rounding each family's
// angle to its nearest of those four), so the anisotropy is legible as
// actual oriented line-work, not texture. Below the cutoff (unetched or
// mid-repolish) a sparse subset of cells show a faint muted "." grain --
// the raw polished metal's own micro-texture, present everywhere the
// crystal pattern hasn't (yet, or any longer) grown over it.
//
// Colour: canvas fill is --background (this is a self-contained backdrop,
// not reliant on a parent already painting the token), grain is --ns-muted,
// the etched pattern is --foreground with luminance as alpha, all read via
// getComputedStyle and re-read on a documentElement class MutationObserver.
// aria-hidden, pointer-events-none: it never listens for input and carries
// no content. prefers-reduced-motion draws one static fully-etched frame
// with no front and no shimmer.
// ---------------------------------------------------------------------------

const ORIENTED = ["-", "|", "\\", "/"] as const; // by family index
const GRAIN_GLYPH = ".";
const ALPHA_BUCKETS = 6;

const OCTA_ANGLE = Math.acos(1 / 3); // ~70.5288deg, adjacent-{111}-normal angle
const FAMILY_COUNT = 4;
/** lath width per family, in cell-pitch multiples -- distinct plate widths */
const BAND_SPACING_CELLS = [7.5, 6.2, 8.6, 7.1];
const SPACING_JITTER = 0.22; // +-22% band-to-band thickness noise
const SWEEP_ANGLE = (52 * Math.PI) / 180; // bath direction, independent of the lattice
const SWEEP_SECONDS = 90; // time for the front to cross the diagonal once
const RISE_W = 0.05; // surfacing ramp, in s-units
const IDLE_W = 0.78; // fully-etched hold, in s-units
const FALL_W = 0.1; // repolish ramp, in s-units
const S_RANGE = RISE_W + IDLE_W + FALL_W;
const FAINT_CUTOFF = 0.32;
const CONTRAST_MIN = 0.5;
const CONTRAST_SPAN = 0.5;
const EDGE_BOOST = 0.28;
const SHIMMER_AMP = 0.09;
const SHIMMER_FREQ = 0.6; // rad/s
const SHIMMER_SPATIAL_FREQ = 0.02; // rad/px along the band's own axis
const BAND_PHASE_STEP = 1.37; // rad per band id, decorrelates adjacent bands
const GRAIN_DENSITY = 0.14;
const GRAIN_ALPHA = 0.15;
const DT_MAX = 0.05;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** cheap deterministic hash -> [0,1), used for per-band contrast. */
function hash01(a: number, b: number, seed: number): number {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + seed) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth01(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
}

/** irregular-spacing boundary line positions covering [minV, maxV] with margin. */
function buildBoundaries(
  minV: number,
  maxV: number,
  spacing: number,
  rand: () => number
): Float64Array {
  const arr: number[] = [];
  let pos = minV - spacing;
  arr.push(pos);
  const end = maxV + spacing;
  while (pos < end) {
    pos += Math.max(2, spacing * (1 + (rand() * 2 - 1) * SPACING_JITTER));
    arr.push(pos);
  }
  return Float64Array.from(arr);
}

function bandIndexOf(boundaries: Float64Array, u: number): number {
  const last = boundaries.length - 1;
  if (u <= boundaries[0]) return 0;
  if (u >= boundaries[last]) return last - 1;
  let lo = 0;
  let hi = last - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (boundaries[mid] <= u) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface KamaciteEtchProps {
  /** grid cell size in px -- also sets the lath-family spacing scale */
  cellSize?: number;
  className?: string;
}

export function KamaciteEtch({
  cellSize = 13,
  className = "",
}: KamaciteEtchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let bg = "";
    let fg = "currentColor";
    let muted = "currentColor";
    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let n = 0;
    let dpr = 1;
    let sized = false;
    let ready = false;
    let disposed = false;

    let sArr = new Float32Array(0);
    let contrastArr = new Float32Array(0);
    let phaseArr = new Float32Array(0);
    let ownerArr = new Uint8Array(0);
    let grainArr = new Uint8Array(0);
    const fgBuckets: number[][] = Array.from(
      { length: ALPHA_BUCKETS },
      () => []
    );
    const grainList: number[] = [];

    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
      const root = getComputedStyle(document.documentElement);
      // never a colour literal: if the token is ever missing, fall back to the
      // live computed page background, which still resolves per theme.
      bg =
        root.getPropertyValue("--background").trim() ||
        getComputedStyle(document.body).backgroundColor;
      muted = root.getPropertyValue("--ns-muted").trim() || fg;
    };

    const measureCell = (fontFamily: string) => {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.font = `${cellSize}px ${fontFamily}`;
      cellW = Math.max(4, octx.measureText("MMMMMMMMMM").width / 10);
      cellH = cellSize;
    };

    /** builds the four lath families and every per-cell derived value once. */
    const buildLattice = () => {
      const W = cols * cellW;
      const H = rows * cellH;
      const pitch = (cellW + cellH) / 2;
      const corners: [number, number][] = [
        [0, 0],
        [W, 0],
        [0, H],
        [W, H],
      ];

      const dirs: { x: number; y: number }[] = [];
      const normals: { x: number; y: number }[] = [];
      const boundaries: Float64Array[] = [];
      const famRand = mulberry32(0x4b616d31);

      for (let k = 0; k < FAMILY_COUNT; k++) {
        const a = (((k * OCTA_ANGLE) % Math.PI) + Math.PI) % Math.PI;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        dirs.push({ x: dx, y: dy });
        const nx = -dy;
        const ny = dx;
        normals.push({ x: nx, y: ny });
        let minU = Infinity;
        let maxU = -Infinity;
        for (const [cx, cy] of corners) {
          const u = cx * nx + cy * ny;
          if (u < minU) minU = u;
          if (u > maxU) maxU = u;
        }
        const spacing = BAND_SPACING_CELLS[k]! * pitch;
        boundaries.push(buildBoundaries(minU, maxU, spacing, famRand));
      }

      const sweepDx = Math.cos(SWEEP_ANGLE);
      const sweepDy = Math.sin(SWEEP_ANGLE);
      let sMin = Infinity;
      let sMax = -Infinity;
      for (const [cx, cy] of corners) {
        const s = cx * sweepDx + cy * sweepDy;
        if (s < sMin) sMin = s;
        if (s > sMax) sMax = s;
      }
      const sSpan = Math.max(1e-6, sMax - sMin);

      const grainRand = mulberry32(0x67721e9);

      let i = 0;
      for (let gy = 0; gy < rows; gy++) {
        const y = gy * cellH + cellH / 2;
        for (let gx = 0; gx < cols; gx++, i++) {
          const x = gx * cellW + cellW / 2;
          sArr[i] = (x * sweepDx + y * sweepDy - sMin) / sSpan;

          let bestFamily = 0;
          let bestResidual = -1;
          let bestBandId = 0;
          for (let k = 0; k < FAMILY_COUNT; k++) {
            const nrm = normals[k]!;
            const u = x * nrm.x + y * nrm.y;
            const b = boundaries[k]!;
            const bi = bandIndexOf(b, u);
            const lo = b[bi]!;
            const hi = b[bi + 1]!;
            const half = (hi - lo) / 2;
            const mid = (lo + hi) / 2;
            const residual = half > 0 ? 1 - Math.abs(u - mid) / half : 0;
            if (residual > bestResidual) {
              bestResidual = residual;
              bestFamily = k;
              bestBandId = bi;
            }
          }

          ownerArr[i] = bestFamily;
          const base =
            CONTRAST_MIN +
            CONTRAST_SPAN * hash01(bestFamily, bestBandId, 0x1357a2c1);
          const edge = (1 - Math.max(0, bestResidual)) * EDGE_BOOST;
          contrastArr[i] = Math.min(1.15, base * (1 + edge));

          const dr = dirs[bestFamily]!;
          phaseArr[i] =
            (x * dr.x + y * dr.y) * SHIMMER_SPATIAL_FREQ +
            bestBandId * BAND_PHASE_STEP;

          grainArr[i] = grainRand() < GRAIN_DENSITY ? 1 : 0;
        }
      }
    };

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width < 2 || height < 2) {
        sized = false;
        return;
      }
      const isCard = !!canvas.closest("[data-autoplay-root]");
      dpr = isCard
        ? Math.min(0.6, window.devicePixelRatio || 1)
        : Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fontFamily = getComputedStyle(canvas).fontFamily;
      measureCell(fontFamily);
      ctx.font = `${cellSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      cols = Math.max(8, Math.ceil(width / cellW));
      rows = Math.max(8, Math.ceil(height / cellH));
      n = cols * rows;
      sArr = new Float32Array(n);
      contrastArr = new Float32Array(n);
      phaseArr = new Float32Array(n);
      ownerArr = new Uint8Array(n);
      grainArr = new Uint8Array(n);
      buildLattice();
      sized = true;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw(0, true);
      }, 150);
    };

    const draw = (tGlobal: number, staticFull: boolean) => {
      if (!sized) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      for (let b = 0; b < ALPHA_BUCKETS; b++) fgBuckets[b]!.length = 0;
      grainList.length = 0;

      const frontPos = tGlobal / SWEEP_SECONDS;

      for (let i = 0; i < n; i++) {
        let developed: number;
        if (staticFull) {
          developed = 1;
        } else {
          const delta = frontPos - sArr[i]!;
          const dm = ((delta % S_RANGE) + S_RANGE) % S_RANGE;
          if (dm < RISE_W) developed = smooth01(dm / RISE_W);
          else if (dm < RISE_W + IDLE_W) developed = 1;
          else developed = 1 - smooth01((dm - RISE_W - IDLE_W) / FALL_W);
        }

        let brightness = developed * contrastArr[i]!;
        if (!staticFull && developed === 1) {
          brightness +=
            SHIMMER_AMP *
            contrastArr[i]! *
            Math.sin(tGlobal * SHIMMER_FREQ + phaseArr[i]!);
        }
        if (brightness < 0) brightness = 0;
        else if (brightness > 1) brightness = 1;

        if (brightness >= FAINT_CUTOFF) {
          const bucket = Math.min(
            ALPHA_BUCKETS - 1,
            Math.floor(brightness * ALPHA_BUCKETS)
          );
          fgBuckets[bucket]!.push(i);
        } else if (grainArr[i]) {
          grainList.push(i);
        }
      }

      if (grainList.length) {
        ctx.fillStyle = muted;
        ctx.globalAlpha = GRAIN_ALPHA;
        for (let k = 0; k < grainList.length; k++) {
          const idx = grainList[k]!;
          const gx = idx % cols;
          const gy = (idx - gx) / cols;
          ctx.fillText(
            GRAIN_GLYPH,
            gx * cellW + cellW / 2,
            gy * cellH + cellH / 2
          );
        }
      }

      ctx.fillStyle = fg;
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const list = fgBuckets[b]!;
        if (!list.length) continue;
        ctx.globalAlpha = 0.22 + (b / (ALPHA_BUCKETS - 1)) * 0.78;
        for (let k = 0; k < list.length; k++) {
          const idx = list[k]!;
          const gx = idx % cols;
          const gy = (idx - gx) / cols;
          ctx.fillText(
            ORIENTED[ownerArr[idx]!],
            gx * cellW + cellW / 2,
            gy * cellH + cellH / 2
          );
        }
      }
      ctx.globalAlpha = 1;
    };

    let raf = 0;
    let last = 0;
    let t = 0;

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      draw(t, false);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        // a queued frame from just before hiding still fires on return;
        // cancel it so the front doesn't advance at double rate forever
        cancelAnimationFrame(raf);
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(0, true);
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      ready = true;
      if (reduced) {
        draw(0, true);
      } else {
        raf = requestAnimationFrame(loop);
      }
    });

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellSize]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none block h-full w-full font-mono text-foreground ${className}`}
    />
  );
}
