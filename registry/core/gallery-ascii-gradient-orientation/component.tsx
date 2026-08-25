"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// GalleryAsciiGradientOrientation — a gallery grid whose tiles stand in for
// photographic content with self-generated imagery: each tile runs its own
// 3-octave value-noise loop (same wave-octave family as background-ascii-
// plasma) into a small offscreen scalar buffer, mulberry32-seeded per tile
// index so every tile settles into a distinct, phase-locked drifting field
// instead of all nine looking identical. A 3x3 SOBEL operator on that raw
// buffer — never on rendered pixels — gives every glyph cell a gradient
// ANGLE, bucketed into '-', '/', '|', '\' the same 4-way slope split
// background-ascii-flow uses for velocity heading. This is a categorically
// different input: flow keys the alphabet to a simulated field's direction
// of TRAVEL, this keys it to a generated image's own gradient NORMAL,
// recomputed from the noise scalar every frame. Only the strongest ~12% of
// cells by magnitude survive an adaptive per-frame percentile cut (never a
// fixed threshold — sparsity has to track the scene's own shifting local
// contrast), so the field reads as a moving edge sketch, not a wash. The
// buffer is supersampled ~3x the glyph grid's own resolution so the Sobel
// estimate isn't degenerate at 1:1 with the glyph pitch. Color never
// touches the buffer: every cell's selection and angle are decided on the
// bare 0..1 scalar array, and --foreground is assigned only at the final
// glyph-draw step — so edge selection is byte-identical between themes.
// ---------------------------------------------------------------------------

const DIR_CHARS = ["-", "/", "|", "\\"] as const;
const SUPERSAMPLE = 3; // buffer cells per glyph cell, each axis
const TOP_PERCENT = 0.12; // fraction of cells kept after the magnitude cut
const FIELD_SPEED = 0.5; // t units / s

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// three summed sine octaves, same family as background-ascii-plasma's
// fieldValue: a slow isotropic swell, a mid-frequency crossing band, a fast
// fine ripple — offset per axis by a mulberry32-drawn phase so each tile's
// field is a distinct variant of the same recipe, never a copy.
function fieldValue(x: number, y: number, t: number, px: number, py: number, pt: number): number {
  const xx = x + px;
  const yy = y + py;
  const tt = t + pt;
  const a = Math.sin(xx * 0.5 + tt * 0.7) + Math.sin(yy * 0.46 - tt * 0.55) + Math.sin((xx - yy) * 0.33 + tt * 0.4);
  const b = Math.sin(xx * 1.35 - tt * 1.4) + Math.sin(yy * 1.1 + tt * 1.1);
  const c = Math.sin(xx * 2.5 + yy * 2.1 + tt * 2.6) + Math.sin((xx + yy) * 2.8 - tt * 3.1);
  const v = a * 0.5 + b * 0.32 + c * 0.18;
  return v / 5 + 0.5; // rough-normalize to ~0..1
}

function dirChar(gx: number, gy: number): string {
  // angle of the gradient VECTOR itself, folded to [0, PI) since an edge's
  // orientation is undirected — same fold+bucket background-ascii-flow uses
  // for velocity heading, applied here to a gradient normal instead.
  let a = Math.atan2(gy, gx) % Math.PI;
  if (a < 0) a += Math.PI;
  const idx = Math.round(a / (Math.PI / 4)) % 4;
  return DIR_CHARS[idx]!;
}

interface Tile {
  seed: number;
  px: number;
  py: number;
  pt: number;
}

interface TileGeom {
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
  bufW: number;
  bufH: number;
  field: Float32Array;
  gx: Float32Array;
  gy: Float32Array;
  mag: Float32Array;
  sizedW: number;
  sizedH: number;
}

export interface GalleryAsciiGradientOrientationProps {
  /** number of generated tiles */
  tileCount?: number;
  /** grid columns at the default breakpoint */
  columns?: number;
  /** glyph grid cell size in px */
  cellSize?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function GalleryAsciiGradientOrientation({
  tileCount = 9,
  columns = 3,
  cellSize = 9,
  className = "",
}: GalleryAsciiGradientOrientationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fg = "currentColor";
    let disposed = false;
    let ready = false;
    let raf = 0;
    let last = 0;
    let t = 0;

    const tiles: Tile[] = Array.from({ length: tileCount }, (_, i) => {
      // mulberry32 seeded per tile index -> the phase draw itself is the
      // "per tile position" seed: distinct tiles never share a field.
      const rand = mulberry32(0x9e3779b1 ^ (i * 0x2545f491 + 1));
      return {
        seed: i,
        px: rand() * 1000,
        py: rand() * 1000,
        pt: rand() * 1000,
      };
    });

    const geoms: (TileGeom | null)[] = new Array(tileCount).fill(null);

    const readTokens = () => {
      fg = getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim() || fg;
    };

    // measured post-fonts.ready, off-DOM — a fallback-font advance width
    // bakes in the wrong grid ratio otherwise.
    const measureCell = () => {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return { cellW: cellSize, cellH: cellSize };
      const fontFamily = getComputedStyle(container).fontFamily || "ui-monospace, monospace";
      octx.font = `${cellSize}px ${fontFamily}`;
      const cellW = Math.max(3, octx.measureText("MMMMMMMMMM").width / 10);
      return { cellW, cellH: cellSize };
    };

    const buildGeom = (canvas: HTMLCanvasElement): TileGeom | null => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width < 4 || height < 4) return null;
      const { cellW, cellH } = measureCell();
      const cols = Math.max(2, Math.floor(width / cellW));
      const rows = Math.max(2, Math.floor(height / cellH));
      const bufW = cols * SUPERSAMPLE + 2; // +2 border for the Sobel kernel
      const bufH = rows * SUPERSAMPLE + 2;
      return {
        cellW,
        cellH,
        cols,
        rows,
        bufW,
        bufH,
        field: new Float32Array(bufW * bufH),
        gx: new Float32Array(cols * rows),
        gy: new Float32Array(cols * rows),
        mag: new Float32Array(cols * rows),
        sizedW: width,
        sizedH: height,
      };
    };

    const sizeCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, geom: TileGeom) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(geom.sizedW * dpr));
      canvas.height = Math.max(1, Math.round(geom.sizedH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fontFamily = getComputedStyle(canvas).fontFamily || "ui-monospace, monospace";
      ctx.font = `${cellSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
    };

    const resizeAll = () => {
      let anySized = false;
      canvasRefs.current.forEach((canvas, i) => {
        if (!canvas) return;
        const geom = buildGeom(canvas);
        geoms[i] = geom;
        if (!geom) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        sizeCanvas(canvas, ctx, geom);
        anySized = true;
      });
      return anySized;
    };

    // Sobel + adaptive-threshold + draw for one tile at time `tt`. Every
    // step reads the raw Float32Array noise buffer directly — never
    // ctx.getImageData — so the two themes select byte-identical cells;
    // color is assigned only in the final fillText loop.
    const renderTile = (canvas: HTMLCanvasElement, tile: Tile, geom: TileGeom, tt: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { cellW, cellH, cols, rows, bufW, bufH, field, gx, gy, mag } = geom;

      // fill the raw noise scalar buffer, one field sample per supersampled
      // cell (buffer coords run -1..cols*SUPERSAMPLE so the Sobel kernel has
      // a real neighbor on every edge cell it evaluates).
      for (let by = 0; by < bufH; by++) {
        const ny = ((by - 1) / (rows * SUPERSAMPLE)) * rows;
        for (let bx = 0; bx < bufW; bx++) {
          const nx = ((bx - 1) / (cols * SUPERSAMPLE)) * cols;
          field[by * bufW + bx] = fieldValue(nx, ny, tt, tile.px, tile.py, tile.pt);
        }
      }

      // 3x3 Sobel over the raw scalar buffer, aggregated (vector-summed) per
      // glyph cell's SUPERSAMPLE x SUPERSAMPLE block so the gradient
      // estimate isn't degenerate at 1:1 with the glyph pitch.
      let maxMag = 1e-6;
      for (let gyi = 0; gyi < rows; gyi++) {
        for (let gxi = 0; gxi < cols; gxi++) {
          let sumGx = 0;
          let sumGy = 0;
          for (let dy = 0; dy < SUPERSAMPLE; dy++) {
            for (let dx = 0; dx < SUPERSAMPLE; dx++) {
              // +1 shifts into the padded buffer; the 3x3 kernel then always
              // has a real neighbor in every direction.
              const cx = gxi * SUPERSAMPLE + dx + 1;
              const cy = gyi * SUPERSAMPLE + dy + 1;
              const tl = field[(cy - 1) * bufW + (cx - 1)]!;
              const tc = field[(cy - 1) * bufW + cx]!;
              const tr = field[(cy - 1) * bufW + (cx + 1)]!;
              const ml = field[cy * bufW + (cx - 1)]!;
              const mr = field[cy * bufW + (cx + 1)]!;
              const bl = field[(cy + 1) * bufW + (cx - 1)]!;
              const bc = field[(cy + 1) * bufW + cx]!;
              const br = field[(cy + 1) * bufW + (cx + 1)]!;
              sumGx += -tl + tr - 2 * ml + 2 * mr - bl + br;
              sumGy += -tl - 2 * tc - tr + bl + 2 * bc + br;
            }
          }
          const idx = gyi * cols + gxi;
          gx[idx] = sumGx;
          gy[idx] = sumGy;
          const m = Math.hypot(sumGx, sumGy);
          mag[idx] = m;
          if (m > maxMag) maxMag = m;
        }
      }

      // adaptive percentile cut: recomputed every frame over this tile's own
      // magnitude distribution, so sparsity tracks the field's own shifting
      // local contrast rather than a fixed cutoff.
      const cellCount = cols * rows;
      const sorted = Array.from(mag).sort((a, b) => a - b);
      const cutIdx = Math.min(cellCount - 1, Math.floor(cellCount * (1 - TOP_PERCENT)));
      const threshold = sorted[cutIdx] ?? 0;

      ctx.clearRect(0, 0, geom.sizedW, geom.sizedH);
      ctx.fillStyle = fg;
      for (let gyi = 0; gyi < rows; gyi++) {
        for (let gxi = 0; gxi < cols; gxi++) {
          const idx = gyi * cols + gxi;
          if (mag[idx]! < threshold) continue;
          const ch = dirChar(gx[idx]!, gy[idx]!);
          ctx.fillText(ch, gxi * cellW + cellW / 2, gyi * cellH + cellH / 2);
        }
      }
    };

    const drawAll = (tt: number) => {
      canvasRefs.current.forEach((canvas, i) => {
        const geom = geoms[i];
        if (!canvas || !geom) return;
        renderTile(canvas, tiles[i]!, geom, tt);
      });
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        if (resizeAll() && reduced) drawAll(0);
      }, 150);
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt * FIELD_SPEED;
      drawAll(t);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) drawAll(0);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const ro = new ResizeObserver(() => onResize());
    ro.observe(container);

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resizeAll();
      ready = true;
      if (reduced) {
        // freeze at t=0: the mulberry32 seed guarantees per-tile structure
        // from frame one, so t=0 is never a degenerate all-flat frame.
        drawAll(0);
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
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileCount, cellSize]);

  return (
    <div
      ref={containerRef}
      className={`grid gap-3 font-mono ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: tileCount }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Gallery item ${i + 1}: generative edge-sketch pattern`}
          className="relative aspect-square overflow-hidden rounded-md border border-border outline-none transition-colors hover:border-ns-accent focus-visible:border-ns-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          <canvas
            ref={(el) => {
              canvasRefs.current[i] = el;
            }}
            aria-hidden
            className="block h-full w-full"
          />
        </button>
      ))}
    </div>
  );
}
