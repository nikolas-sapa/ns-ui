"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// ScarpHorizon — a full-bleed ASCII landscape hero. Five ridgelines recede
// toward a fixed horizon row, each a deterministic 1D value-noise curve (two
// octaves, fixed hash seed per layer — the terrain never reshuffles on
// remount) sampled at an ever-larger spatial frequency and amplitude going
// from farthest to nearest, so distant ridges read as smooth low rolling haze
// and the nearest ridge reads as jagged and dense. Every column is resolved
// far-to-near into one Uint8Array "which layer wins this cell" buffer before
// a single render pass — that overwrite-in-draw-order is what gives clean
// occlusion (a nearer ridge silhouette blotting out a farther one) instead of
// two glyphs stacked translucently in the same cell. Layer opacity and ramp
// character both step up with proximity (haze -> ink). A sparse fixed star
// field fills the sky above the horizon, each star's alpha breathing on a
// slow sine so the sky isn't a dead flat void. The pointer drives parallax —
// each layer's horizontal (and slightly vertical) sample offset is scaled by
// its own proximity factor, eased, plus a slow idle drift so the scene keeps
// a pulse even at rest — so panning across the field reads like a window
// gliding past terrain, nearer ridges sliding faster than the horizon.
// ---------------------------------------------------------------------------

const RAMP = " .:-=+*#%@"; // 10-step density ramp, index 0 = blank

interface Layer {
  freq: number; // spatial frequency in noise-space, per column
  baseFrac: number; // fraction of terrain band the ridge's average sits at
  ampFrac: number; // fraction of terrain band the ridge swings by
  parallax: number; // 0..1, how much this layer answers to the pointer
  drift: number; // idle ambient pan, in GRID COLUMNS/s (not noise-space)
  alpha: number; // resting opacity, haze (far) -> ink (near)
  charIdx: number; // index into RAMP
  seedA: number;
  seedB: number;
}

// far -> near: frequency, base depth and amplitude all step up together —
// the nearest ridge is the tallest, most jagged, and reaches lowest in frame.
// Amplitude is large relative to the gap between layers on purpose: a ridge
// silhouette only reads as terrain if it has real peaks and valleys, not a
// nearly flat line with a haze tint.
//
// `drift` used to be one global constant (IDLE_DRIFT) multiplied through
// `parallax`, same as the pointer offset. That reads as "barely moving" no
// matter how large the constant gets: the ridge only repaints when the
// sampled noise crosses into a different grid COLUMN, and with parallax
// spanning 0.05 -> 0.95 the resulting pace was ~1 column every 125s on the
// farthest layer and ~1 column every 6.6s even on the nearest — both well
// below what a glance registers, confirmed at 0% of cells changing per
// second measured over a 6s sample at rest. `drift` is now authored directly
// in columns/second, decoupled from `parallax` (which still governs only the
// pointer response): the near layer crosses a column every ~0.3s, the far
// layer keeps drifting slowly rather than being effectively frozen.
const LAYERS: Layer[] = [
  { freq: 0.012, baseFrac: 0.0, ampFrac: 0.11, parallax: 0.05, drift: 0.45, alpha: 0.24, charIdx: 1, seedA: 11, seedB: 511 },
  { freq: 0.018, baseFrac: 0.14, ampFrac: 0.16, parallax: 0.18, drift: 0.9, alpha: 0.44, charIdx: 3, seedA: 23, seedB: 727 },
  { freq: 0.026, baseFrac: 0.32, ampFrac: 0.2, parallax: 0.38, drift: 1.7, alpha: 0.64, charIdx: 5, seedA: 47, seedB: 941 },
  { freq: 0.038, baseFrac: 0.52, ampFrac: 0.24, parallax: 0.62, drift: 2.8, alpha: 0.84, charIdx: 7, seedA: 71, seedB: 1153 },
  { freq: 0.055, baseFrac: 0.74, ampFrac: 0.27, parallax: 0.95, drift: 4.5, alpha: 1, charIdx: 9, seedA: 97, seedB: 1381 },
];

const STAR_CHARS = [1, 2, 3]; // RAMP indices used for stars
const CURSOR_EASE = 0.08;
const MAX_PARALLAX_COLS = 46; // world-unit shift at full pointer travel
const MAX_PARALLAX_ROWS = 5;
const DT_MAX = 0.05;

// deterministic hash -> [0,1); fixed seed means the terrain is the same
// shape every mount, never reshuffled
function hash1(n: number, seed: number): number {
  const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function noise1D(x: number, seed: number): number {
  const i0 = Math.floor(x);
  const i1 = i0 + 1;
  const t = x - i0;
  const s = t * t * (3 - 2 * t);
  const a = hash1(i0, seed);
  const b = hash1(i1, seed);
  return a + (b - a) * s;
}

// two octaves, weighted 0.7/0.3, mapped to -1..1
function ridgeNoise(x: number, seedA: number, seedB: number): number {
  const n = noise1D(x, seedA) * 0.7 + noise1D(x * 2.7 + 11.3, seedB) * 0.3;
  return n * 2 - 1;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ScarpHorizonProps {
  /** grid cell size in px */
  cellSize?: number;
  /** headline / CTA rendered over the field */
  children?: ReactNode;
  className?: string;
}

export function ScarpHorizon({
  cellSize = 13,
  children,
  className = "",
}: ScarpHorizonProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let fg = "currentColor";
    let muted = "currentColor";
    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let sized = false;
    let ready = false;
    let disposed = false;

    let horizonRow = 0;
    let terrainRows = 0;

    let grpBuf = new Int8Array(0); // -1 = sky/blank, 0..LAYERS.length-1 = layer
    let charBuf = new Uint8Array(0);

    let starCol = new Float32Array(0);
    let starRow = new Float32Array(0);
    let starChar = new Uint8Array(0);
    let starPhase = new Float32Array(0);
    let starAlpha = new Float32Array(0);
    let starCount = 0;

    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
      muted =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--ns-muted")
          .trim() || fg;
    };

    const measureCell = (fontFamily: string) => {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.font = `${cellSize}px ${fontFamily}`;
      cellW = Math.max(4, octx.measureText("MMMMMMMMMM").width / 10);
      cellH = cellSize;
    };

    const buildStars = () => {
      const skyRows = horizonRow;
      const rand = mulberry32(0xa57e0);
      starCount = Math.min(240, Math.max(0, Math.floor(cols * skyRows * 0.035)));
      starCol = new Float32Array(starCount);
      starRow = new Float32Array(starCount);
      starChar = new Uint8Array(starCount);
      starPhase = new Float32Array(starCount);
      starAlpha = new Float32Array(starCount);
      for (let i = 0; i < starCount; i++) {
        starCol[i] = Math.floor(rand() * cols);
        starRow[i] = Math.floor(rand() * Math.max(1, skyRows - 1));
        starChar[i] = STAR_CHARS[Math.floor(rand() * STAR_CHARS.length)];
        starPhase[i] = rand() * Math.PI * 2;
        starAlpha[i] = 0.25 + rand() * 0.4;
      }
    };

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width < 2 || height < 2) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fontFamily = getComputedStyle(canvas).fontFamily;
      measureCell(fontFamily);
      ctx.font = `${cellSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // `ceil`, not `floor`: the grid is `rows * cellH` tall, so flooring left
      // an unpainted strip up to one cell high along the bottom edge — read as
      // a stray band of padding under the terrain. Overdrawing by a partial
      // row instead costs nothing, because the root clips with
      // `overflow-hidden`. Same for columns and the right edge.
      cols = Math.max(8, Math.ceil(width / cellW));
      rows = Math.max(10, Math.ceil(height / cellH));
      horizonRow = Math.max(2, Math.floor(rows * 0.34));
      terrainRows = Math.max(1, rows - horizonRow);

      grpBuf = new Int8Array(cols * rows);
      charBuf = new Uint8Array(cols * rows);
      buildStars();
      sized = true;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw(0, 0, 0);
      }, 150);
    };

    const draw = (t: number, offX: number, offY: number) => {
      if (!sized) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);
      grpBuf.fill(-1);
      charBuf.fill(0);

      // -- terrain: far -> near, each layer overwrites the cells it covers --
      for (let li = 0; li < LAYERS.length; li++) {
        const layer = LAYERS[li];
        // pointer parallax and idle drift are two different units on
        // purpose: pointer offset is already in grid columns (scaled by
        // proximity), idle drift is authored directly in columns/s per
        // layer — see the comment on `LAYERS` for why they used to share
        // one constant and why that read as motionless.
        const worldOffX = offX * layer.parallax + t * layer.drift;
        const worldOffY = offY * layer.parallax * 0.6;
        for (let c = 0; c < cols; c++) {
          const nx = (c + worldOffX) * layer.freq;
          const n = ridgeNoise(nx, layer.seedA, layer.seedB);
          let ridge =
            horizonRow +
            layer.baseFrac * terrainRows +
            n * layer.ampFrac * terrainRows -
            worldOffY;
          ridge = Math.max(horizonRow, Math.min(rows - 1, Math.round(ridge)));
          // flat body at the layer's own density — no internal gradient — so
          // the boundary against the (lighter) layer behind it stays a hard,
          // legible edge instead of blurring into a continuous field
          for (let r = ridge; r < rows; r++) {
            const idx = r * cols + c;
            grpBuf[idx] = li;
            charBuf[idx] = layer.charIdx;
          }
          // one-row crest highlight, denser than the layer's own body, so the
          // silhouette line itself reads as a distinct rim against the haze
          const crestIdx = ridge * cols + c;
          charBuf[crestIdx] = Math.min(RAMP.length - 1, layer.charIdx + 1);
        }
      }

      // -- sky: sparse breathing stars, drawn directly (no grid buffer) -----
      ctx.fillStyle = muted;
      for (let i = 0; i < starCount; i++) {
        const twinkle = 0.5 + 0.5 * Math.sin(t * 1.1 + starPhase[i]);
        ctx.globalAlpha = starAlpha[i] * twinkle;
        ctx.fillText(
          RAMP[starChar[i]],
          starCol[i] * cellW + cellW / 2,
          starRow[i] * cellH + cellH / 2
        );
      }

      // -- terrain render: one pass per layer, one globalAlpha set each -----
      ctx.fillStyle = fg;
      for (let li = 0; li < LAYERS.length; li++) {
        const layer = LAYERS[li];
        ctx.globalAlpha = layer.alpha;
        for (let r = horizonRow; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            if (grpBuf[idx] !== li) continue;
            ctx.fillText(
              RAMP[charBuf[idx]],
              c * cellW + cellW / 2,
              r * cellH + cellH / 2
            );
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    // -- hot-path state: locals only, never React state ---------------------
    let raf = 0;
    let last = 0;
    let t = 0;
    const cursor = { tx: 0, ty: 0, x: 0, y: 0 };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      cursor.x += (cursor.tx - cursor.x) * CURSOR_EASE;
      cursor.y += (cursor.ty - cursor.y) * CURSOR_EASE;
      draw(t, cursor.x, cursor.y);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5; // -0.5..0.5
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      cursor.tx = nx * MAX_PARALLAX_COLS;
      cursor.ty = ny * MAX_PARALLAX_ROWS;
    };
    const onPointerLeave = () => {
      cursor.tx = 0;
      cursor.ty = 0;
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(0, 0, 0);
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
        draw(0, 0, 0);
      } else {
        raf = requestAnimationFrame(loop);
      }
    });

    window.addEventListener("resize", onResize);
    if (!reduced) {
      root.addEventListener("pointermove", onPointerMove);
      root.addEventListener("pointerleave", onPointerLeave);
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellSize]);

  // `h-full` matters as much as the min-height below: a min-height only sets a
  // FLOOR. Dropped into a stretched grid/flex item taller than that floor — an
  // auth panel whose other column carries more copy — the root stopped at its
  // min-height and the canvas ended partway down, leaving a band of dead
  // background under the terrain. `h-full` resolves to `auto` when the parent
  // has no definite height (so the min-height still governs a standalone
  // hero) and fills the parent when it does.
  return (
    <div
      ref={rootRef}
      className={`relative isolate h-full w-full overflow-hidden bg-background font-mono ${
        /\bmin-h-/.test(className) ? "" : "min-h-screen"
      } ${className}`}
    >
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 block h-full w-full text-foreground" />
      {children ? (
        <div className="relative z-10 flex h-full w-full flex-col items-start justify-end gap-4 p-8 sm:p-14">
          {children}
        </div>
      ) : null}
    </div>
  );
}
