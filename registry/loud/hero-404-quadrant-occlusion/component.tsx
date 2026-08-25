"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// QuadrantOcclusion404 — a full-bleed 404 hero that renders the numeral
// "404" and an orbiting occluding disc from ONE shared silhouette, at
// HALF-CELL precision, using Unicode quadrant/half-block glyphs
// (▘▝▖▗▚▞▛▜▙▟█▀▄▌▐). Every other ASCII component in this registry quantizes
// to one glyph = one full-cell density value; nothing else renders sub-cell
// partial-block geometry. That is the entire point of this component.
//
// Each glyph cell owns a 2x2 addressable sub-grid (TL/TR/BL/BR). The "404"
// numeral is rasterized once (after document.fonts.ready) into an offscreen
// alpha mask and area-averaged into a static per-sub-cell coverage table —
// this never changes after resize, since the numeral itself is stationary.
// The occluder is a disc with a low-order radial harmonic on its edge
// (r(theta) = R * (1 + a*sin(3*theta + wt))), tested analytically at each of
// the same 4 sub-positions every frame — no raster, just a distance compare.
// Per cell, per frame: combinedBits = occluderBits | numeralBits, looked up
// in a 16-entry quadrant-glyph table for the shape; the CELL'S COLOR is
// --foreground if any of its 4 sub-positions belongs to the occluder (the
// disc always "wins" and stays legible whether it's crossing ink or empty
// space) and --ns-muted otherwise. The occluder's curved edge is therefore
// always the sub-cell-resolved boundary in motion — the crisp half-cell
// silhouette is demonstrated continuously, not in a static crop.
//
// Cell metrics come from measureText("█") (the full block), not a
// letter — block glyphs tile by their own ink box, and measuring "M" (the
// ramp-glyph convention elsewhere in this registry) can shear the grid if
// the loaded font's block-glyph advance differs from its letter advance.
// Draw uses textAlign="left"/textBaseline="alphabetic" at
// (col*cellW, row*cellH + ascent) so cells tile edge-to-edge by construction
// regardless of what the font does internally.
// ---------------------------------------------------------------------------

// bit order: TL=1, TR=2, BL=4, BR=8
const QUAD_GLYPH = [
  " ", // 0
  "▘", // 1  TL
  "▝", // 2  TR
  "▀", // 3  TL+TR (top half)
  "▖", // 4  BL
  "▌", // 5  TL+BL (left half)
  "▞", // 6  TR+BL
  "▛", // 7  TL+TR+BL
  "▗", // 8  BR
  "▚", // 9  TL+BR
  "▐", // 10 TR+BR (right half)
  "▜", // 11 TL+TR+BR
  "▄", // 12 BL+BR (bottom half)
  "▙", // 13 TL+BL+BR
  "▟", // 14 TR+BL+BR
  "█", // 15 full block
];

const SUB_DX = [0.25, 0.75, 0.25, 0.75]; // TL, TR, BL, BR
const SUB_DY = [0.25, 0.25, 0.75, 0.75];
const MASK_OVERSAMPLE = 2; // one-time rasterization quality, not per-frame cost
const COVERAGE_THRESHOLD = 0.42; // fraction of a sub-cell's mask alpha to count as "ink"
const ORBIT_HARMONIC_K = 3; // radial lobes on the occluder's edge
const ORBIT_HARMONIC_AMP = 0.22; // fraction of radius the lobes displace
const POINTER_BIAS_EASE = 0.06;
const DT_MAX = 0.05;

// reduced-motion static frame: the occluder is parked off-center over the
// numeral rather than clear of it or centered in a glyph's dead space —
// chosen to maximize the count of cells whose 4-bit code is neither 0
// (empty) nor 15 (solid), i.e. genuinely partial half-cell cells, which is
// the state this component exists to show. A parked-clear or
// fully-covering position would both minimize that count instead.
const STATIC_OFFSET_X = 0.62; // fraction of orbit radius, right of numeral center
const STATIC_OFFSET_Y = -0.12;

export interface QuadrantOcclusion404Props {
  /** grid cell size in px (font-size fed into measureText, not the final cell box) */
  cellSize?: number;
  /** occluder disc radius in px; default derives proportionally from the container */
  occluderRadius?: number;
  /** copy / CTAs rendered under the numeral field */
  children?: ReactNode;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function QuadrantOcclusion404({
  cellSize = 16,
  occluderRadius,
  children,
  className = "",
}: QuadrantOcclusion404Props) {
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

    // -- tokens: read synchronously, before any observer/rAF is armed, so
    // nothing can ever paint with a placeholder value (rule: no color
    // literal, and no path may draw before the real read lands) -----------
    let fg = "";
    let muted = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = cs.getPropertyValue("--foreground").trim();
      muted = cs.getPropertyValue("--ns-muted").trim();
    };
    readTokens();

    let cellW = cellSize;
    let cellH = cellSize;
    let ascent = cellSize;
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let sized = false;
    let ready = false;
    let disposed = false;

    let cx = 0; // numeral/orbit center, css px
    let cy = 0;
    let orbitRx = 0;
    let orbitRy = 0;
    let baseOccluderR = occluderRadius ?? 0;

    // static per-subcell numeral coverage — (cols*2) x (rows*2), rebuilt
    // only on resize/font-ready, never per frame (the numeral doesn't move)
    let numeralSub = new Uint8Array(0);
    let subCols = 0;
    let subRows = 0;

    const measureCell = (fontFamily: string) => {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.font = `${cellSize}px ${fontFamily}`;
      const m = octx.measureText("█");
      cellW = Math.max(4, m.width);
      const a = m.actualBoundingBoxAscent || cellSize * 0.8;
      const d = m.actualBoundingBoxDescent || cellSize * 0.2;
      cellH = Math.max(4, a + d);
      ascent = a;
    };

    const buildNumeralMask = (fontFamily: string) => {
      subCols = cols * 2;
      subRows = rows * 2;
      numeralSub = new Uint8Array(subCols * subRows);
      if (subCols < 2 || subRows < 2) return;

      const w = cols * cellW;
      const h = rows * cellH;
      const os = MASK_OVERSAMPLE;
      const mw = Math.max(1, Math.round(w * os));
      const mh = Math.max(1, Math.round(h * os));

      const mask = document.createElement("canvas");
      mask.width = mw;
      mask.height = mh;
      const mctx = mask.getContext("2d", { willReadFrequently: true });
      if (!mctx) return;
      mctx.clearRect(0, 0, mw, mh);
      const fontPx = Math.min(w, h) * 0.62 * os; // rule 6: derive from the
      // container's smaller dimension, with real margin around the glyphs
      mctx.font = `700 ${fontPx}px ${fontFamily}`;
      mctx.textAlign = "center";
      mctx.textBaseline = "middle";
      // `mask`/`mctx` is a detached, never-appended offscreen canvas used
      // ONLY as an alpha/coverage source: this colour is never read below
      // (only `data[...+3]`, the alpha byte, is used) and `mask` is never
      // drawImage'd anywhere, so it never reaches the visible canvas or the
      // screen in either theme. The fill colour here is arbitrary and could
      // be any opaque value — it is not a token and does not need to be.
      mctx.fillStyle = "#fff";
      mctx.fillText("404", mw / 2, mh / 2);

      const data = mctx.getImageData(0, 0, mw, mh).data;
      const subW = mw / subCols;
      const subH = mh / subRows;
      const sum = new Float64Array(subCols * subRows);
      const count = new Float64Array(subCols * subRows);
      for (let py = 0; py < mh; py++) {
        const sy = Math.min(subRows - 1, Math.floor(py / subH));
        const rowBase = py * mw;
        for (let px = 0; px < mw; px++) {
          const sx = Math.min(subCols - 1, Math.floor(px / subW));
          const idx = sy * subCols + sx;
          sum[idx] += data[(rowBase + px) * 4 + 3]!;
          count[idx] += 255;
        }
      }
      for (let i = 0; i < numeralSub.length; i++) {
        numeralSub[i] = count[i]! > 0 && sum[i]! / count[i]! > COVERAGE_THRESHOLD ? 1 : 0;
      }

      cx = w / 2;
      cy = h / 2;
      const minDim = Math.min(w, h);
      orbitRx = minDim * 0.34;
      orbitRy = minDim * 0.22;
      if (occluderRadius == null) baseOccluderR = minDim * 0.16;
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fontFamily = getComputedStyle(canvas).fontFamily;
      measureCell(fontFamily);
      ctx.font = `${cellSize}px ${fontFamily}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      cols = Math.max(8, Math.ceil(rect.width / cellW));
      rows = Math.max(8, Math.ceil(rect.height / cellH));

      if (ready) buildNumeralMask(fontFamily);
      sized = true;
    };

    // -- per-subposition occluder test: analytic distance vs a radially
    // wobbled disc edge, no raster involved -------------------------------
    const occluderCovered = (
      px: number,
      py: number,
      ox: number,
      oy: number,
      t: number
    ) => {
      const dx = px - ox;
      const dy = py - oy;
      const dist = Math.hypot(dx, dy);
      const theta = Math.atan2(dy, dx);
      const r =
        baseOccluderR *
        (1 + ORBIT_HARMONIC_AMP * Math.sin(ORBIT_HARMONIC_K * theta + t * 0.6));
      return dist <= r;
    };

    const draw = (t: number, ox: number, oy: number) => {
      if (!sized || subCols < 2) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);

      for (let gy = 0; gy < rows; gy++) {
        const cellY = gy * cellH;
        for (let gx = 0; gx < cols; gx++) {
          const cellX = gx * cellW;
          let numBits = 0;
          for (let s = 0; s < 4; s++) {
            const sx = Math.min(subCols - 1, (gx * 2 + (s & 1)) | 0);
            const sy = Math.min(subRows - 1, (gy * 2 + (s >> 1)) | 0);
            if (numeralSub[sy * subCols + sx]) numBits |= 1 << s;
          }
          // cheap reject: skip the 4x hypot/atan2/sin occluder test
          // entirely for the ~95% of cells nowhere near the disc's edge
          const cellCx = cellX + cellW * 0.5;
          const cellCy = cellY + cellH * 0.5;
          const nearOccluder =
            Math.hypot(cellCx - ox, cellCy - oy) <=
            baseOccluderR * (1 + ORBIT_HARMONIC_AMP) + Math.hypot(cellW, cellH);
          let occBits = 0;
          if (nearOccluder) {
            for (let s = 0; s < 4; s++) {
              const px = cellX + cellW * SUB_DX[s]!;
              const py = cellY + cellH * SUB_DY[s]!;
              if (occluderCovered(px, py, ox, oy, t)) occBits |= 1 << s;
            }
          }
          // two draws, not one: over the numeral's interior numBits is
          // already 15, so a single fillStyle-per-cell decision would carry
          // the disc's boundary by COLOR there and stair-step it. Subtract
          // the occluder from the numeral bits and draw each remainder in
          // its own token — the boundary between them is a genuine half-cell
          // shape step in both regions, not just over empty background.
          const numOnly = numBits & ~occBits;
          if (numOnly) {
            ctx.fillStyle = muted;
            ctx.fillText(QUAD_GLYPH[numOnly]!, cellX, cellY + ascent);
          }
          if (occBits) {
            ctx.fillStyle = fg;
            ctx.fillText(QUAD_GLYPH[occBits]!, cellX, cellY + ascent);
          }
        }
      }
    };

    // -- hot-path state ------------------------------------------------------
    let raf = 0;
    let last = 0;
    let t = 0;
    let biasX = 0;
    let biasY = 0;
    let biasTargetX = 0;
    let biasTargetY = 0;
    let pointerActive = false;

    const orbitPos = (time: number) => ({
      x: cx + orbitRx * Math.sin(0.17 * time),
      y: cy + orbitRy * Math.sin(0.11 * time + 1.3),
    });

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;

      const tx = pointerActive ? biasTargetX : 0;
      const ty = pointerActive ? biasTargetY : 0;
      biasX += (tx - biasX) * POINTER_BIAS_EASE;
      biasY += (ty - biasY) * POINTER_BIAS_EASE;

      const base = orbitPos(t);
      draw(t, base.x + biasX, base.y + biasY);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      // pointer BIASES the orbit, never replaces it — an idle pointer
      // parked mid-canvas must not freeze the occluder
      biasTargetX = (e.clientX - rect.left - cx) * 0.35;
      biasTargetY = (e.clientY - rect.top - cy) * 0.35;
      pointerActive = true;
    };
    const onPointerLeave = () => {
      pointerActive = false;
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced && ready) {
          draw(0, cx + orbitRx * STATIC_OFFSET_X, cy + orbitRy * STATIC_OFFSET_Y);
        }
      }, 150);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      const visible = entries[0]?.isIntersecting ?? true;
      if (visible && !document.hidden && !reduced && ready && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      } else if (!visible && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(root);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced && ready) {
        draw(0, cx + orbitRx * STATIC_OFFSET_X, cy + orbitRy * STATIC_OFFSET_Y);
      }
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    document.fonts.ready.then(() => {
      if (disposed) return;
      ready = true; // must land before resize() so buildNumeralMask runs on mount
      resize();
      readTokens();
      if (reduced) {
        draw(0, cx + orbitRx * STATIC_OFFSET_X, cy + orbitRy * STATIC_OFFSET_Y);
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
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellSize, occluderRadius]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate w-full overflow-hidden bg-background font-mono ${
        /\bmin-h-/.test(className) ? "" : "min-h-screen"
      } ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 block h-full w-full text-foreground"
      />
      <h1 className="sr-only">404 — page not found</h1>
      {children ? (
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-end gap-4 p-8 text-center sm:p-14">
          {children}
        </div>
      ) : null}
    </div>
  );
}
