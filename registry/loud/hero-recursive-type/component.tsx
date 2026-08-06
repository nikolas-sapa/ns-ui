"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// NestedSlug — recursive-type hero. The headline is rasterized through a
// hand-authored 5x7 block font into a coarse letterform mask, the same way
// hero-ascii-wordmark does — but rather than lighting a density ramp, every lit coarse
// cell here is subdivided into an NxN grid of small cells, and the filler
// string (a tagline, an install command, whatever the consumer passes) is
// poured through the mask in raster order: one filler character per lit fine
// cell, off cells silently skipped WITHOUT consuming a character so word
// breaks in the filler survive. The result reads as a giant wordmark from
// across the room and, up close, is visibly made of smaller words. The
// pointer is a lens: fine cells within a radius are redrawn scaled up
// (overlapping their neighbors, nearest-to-cursor drawn last) and at higher
// contrast, so the small text becomes genuinely readable exactly where the
// cursor sits and stays a dim, even texture everywhere else. Canvas 2D,
// direct-DOM rAF, mask + fill assignment precomputed once per resize into a
// reused Uint16Array of char codes (0 = blank).
// ---------------------------------------------------------------------------

// Hand-authored 5x7 block font: uppercase A-Z, 0-9, space, and basic
// punctuation. Each glyph is 7 rows of a 5-bit string, MSB-first, top row
// first — hand-drawn geometric shapes, not a traced bitmap font.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10101", "10011", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00010", "00100", "01000", "10000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  ",": ["00000", "00000", "00000", "00000", "00000", "00110", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "'": ["01100", "01100", "01000", "00000", "00000", "00000", "00000"],
};

const GLYPH_W = 5;
const GLYPH_H = 7;
const GLYPH_GAP = 1; // blank coarse columns between letters

const SMALL_TARGET = 15; // px — the fine cell aims for this, snapped so it tiles the coarse cell exactly
const MIN_SUB = 2;
const MAX_SUB = 7;

const REST_ALPHA = 0.95; // legible on its own, without the lens
const WASH_ALPHA = 0.58; // solid coarse-grid wash under the small text — has to
// be bright enough on its own that squinting reads the word instantly; the
// silhouette must not depend on how the filler's varying glyph shapes and
// word-gaps happen to texture any one lit cell
const LENS_MAX_SCALE = 1.9;
const LENS_ALPHA_BOOST = 0.55;
const MARGIN_MULT = 1.9; // lens redraw box radius, as a multiple of lensRadius
const BAND_EDGES = [MARGIN_MULT, 0.85, 0.45, 0]; // d/R upper bounds, far -> near

export interface NestedSlugProps {
  /** the giant wordmark; uppercased, unsupported characters render blank */
  headline: string;
  /** repeating body text poured through the mask's lit cells, in raster order */
  filler: string;
  /** lens radius in px */
  lensRadius?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function NestedSlug({
  headline,
  filler,
  lensRadius = 130,
  className = "",
}: NestedSlugProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const washCv = document.createElement("canvas");
    const wctx = washCv.getContext("2d");
    if (!wctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const chars = Array.from(headline.toUpperCase());
    const coarseCols =
      chars.length * GLYPH_W + Math.max(0, chars.length - 1) * GLYPH_GAP ||
      GLYPH_W;
    const coarseRows = GLYPH_H;

    // resolve the letterform mask once — the font map never changes
    const mask: boolean[][] = Array.from({ length: coarseRows }, () =>
      new Array(coarseCols).fill(false)
    );
    let mcx = 0;
    for (const ch of chars) {
      const glyph = FONT[ch] ?? FONT[" "];
      for (let r = 0; r < GLYPH_H; r++) {
        for (let c = 0; c < GLYPH_W; c++) {
          if (glyph[r][c] === "1") mask[r][mcx + c] = true;
        }
      }
      mcx += GLYPH_W + GLYPH_GAP;
    }

    const fillerChars = Array.from(filler.length ? filler : " ");

    let fg = "currentColor";
    let sub = 4;
    let fineCellPx = 4;
    let fineCols = 0;
    let fineRows = 0;
    let dpr = 1;
    let cellChar: Uint16Array = new Uint16Array(0);
    let coarsePxStored = 0;
    let sized = false;
    let ready = false;
    let disposed = false;
    let raf = 0;

    const cursor = { x: -1e5, y: -1e5, tx: -1e5, ty: -1e5, amt: 0, tAmt: 0 };

    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
    };

    // measured post-fonts.ready — a fallback-font advance width would bake in
    // the wrong subdivision count. This measurement is load-bearing twice
    // over here, since the fine grid nests inside the coarse letterform grid.
    const measureSmallCell = (fontFamily: string) => {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return SMALL_TARGET;
      octx.font = `${SMALL_TARGET}px ${fontFamily}`;
      return Math.max(3, octx.measureText("MMMMMMMMMM").width / 10);
    };

    const build = () => {
      const width = wrap.clientWidth;
      if (width < 2) {
        sized = false;
        return;
      }
      const coarsePx = width / coarseCols;
      const fontFamily = getComputedStyle(canvas).fontFamily;
      const smallCellPx = measureSmallCell(fontFamily);
      sub = Math.max(
        MIN_SUB,
        Math.min(MAX_SUB, Math.round(coarsePx / smallCellPx))
      );
      fineCellPx = coarsePx / sub;
      fineCols = coarseCols * sub;
      fineRows = coarseRows * sub;
      if (fineCols < 1 || fineRows < 1) {
        sized = false;
        return;
      }

      const height = coarsePx * coarseRows;
      wrap.style.height = `${height}px`;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `600 ${fineCellPx * 0.95}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      washCv.width = canvas.width;
      washCv.height = canvas.height;

      cellChar = new Uint16Array(fineCols * fineRows);
      let idx = 0;
      let fi = 0;
      for (let fy = 0; fy < fineRows; fy++) {
        const cRow = (fy / sub) | 0;
        for (let fx = 0; fx < fineCols; fx++, idx++) {
          const cCol = (fx / sub) | 0;
          if (!mask[cRow][cCol]) continue;
          const ch = fillerChars[fi % fillerChars.length];
          fi++;
          if (ch === " " || ch === "\n" || ch === "\t") continue;
          cellChar[idx] = ch.charCodeAt(0);
        }
      }
      coarsePxStored = coarsePx;
      buildWash(coarsePx);
      sized = true;
    };

    // a flat coarse-grid fill under the small text — the actual letterform
    // silhouette comes from THIS, not from the varying ink-weight of whatever
    // filler glyphs happen to land in each cell, so the word stays legible at
    // a glance no matter what filler string is passed. Static per resize/theme.
    const buildWash = (coarsePx: number) => {
      wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      wctx.clearRect(0, 0, coarseCols * coarsePx, coarseRows * coarsePx);
      wctx.fillStyle = fg;
      wctx.globalAlpha = WASH_ALPHA;
      for (let r = 0; r < coarseRows; r++) {
        for (let c = 0; c < coarseCols; c++) {
          if (mask[r][c]) wctx.fillRect(c * coarsePx, r * coarsePx, coarsePx, coarsePx);
        }
      }
      wctx.globalAlpha = 1;
    };

    const drawLensBox = (
      bc0: number,
      bc1: number,
      br0: number,
      br1: number
    ) => {
      const amt = cursor.amt;
      for (let band = 0; band < BAND_EDGES.length - 1; band++) {
        const hi = BAND_EDGES[band];
        const lo = BAND_EDGES[band + 1];
        for (let fy = br0; fy < br1; fy++) {
          const py = fy * fineCellPx + fineCellPx / 2;
          for (let fx = bc0; fx < bc1; fx++) {
            const code = cellChar[fy * fineCols + fx];
            if (!code) continue;
            const px = fx * fineCellPx + fineCellPx / 2;
            const dx = px - cursor.x;
            const dy = py - cursor.y;
            const dNorm = Math.sqrt(dx * dx + dy * dy) / lensRadius;
            if (dNorm >= hi || dNorm < lo) continue;
            const falloff = Math.exp(-(dNorm * dNorm));
            const boost = amt * falloff;
            const scale = 1 + boost * (LENS_MAX_SCALE - 1);
            ctx.globalAlpha = Math.min(
              1,
              REST_ALPHA + boost * LENS_ALPHA_BOOST
            );
            const glyph = String.fromCharCode(code);
            if (scale > 1.02) {
              ctx.save();
              ctx.translate(px, py);
              ctx.scale(scale, scale);
              ctx.fillText(glyph, 0, 0);
              ctx.restore();
            } else {
              ctx.fillText(glyph, px, py);
            }
          }
        }
      }
    };

    const draw = () => {
      if (!sized) return;
      const w = fineCols * fineCellPx;
      const h = fineRows * fineCellPx;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(washCv, 0, 0);
      ctx.restore();
      ctx.fillStyle = fg;

      const active = cursor.amt > 0.01;
      let bc0 = 0,
        bc1 = 0,
        br0 = 0,
        br1 = 0,
        boxActive = false;
      if (active) {
        const margin =
          Math.ceil((lensRadius * MARGIN_MULT) / fineCellPx) + 1;
        const ccx = cursor.x / fineCellPx;
        const ccy = cursor.y / fineCellPx;
        bc0 = Math.max(0, Math.floor(ccx - margin));
        bc1 = Math.min(fineCols, Math.ceil(ccx + margin));
        br0 = Math.max(0, Math.floor(ccy - margin));
        br1 = Math.min(fineRows, Math.ceil(ccy + margin));
        boxActive = bc1 > bc0 && br1 > br0;
      }

      // pass 1 — base texture, skipping the lens box (redrawn in pass 2)
      ctx.globalAlpha = REST_ALPHA;
      let idx = 0;
      for (let fy = 0; fy < fineRows; fy++) {
        const py = fy * fineCellPx + fineCellPx / 2;
        const inRowBox = boxActive && fy >= br0 && fy < br1;
        for (let fx = 0; fx < fineCols; fx++, idx++) {
          const code = cellChar[idx];
          if (!code) continue;
          if (inRowBox && fx >= bc0 && fx < bc1) continue;
          const px = fx * fineCellPx + fineCellPx / 2;
          ctx.fillText(String.fromCharCode(code), px, py);
        }
      }

      if (boxActive) drawLensBox(bc0, bc1, br0, br1);
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      cursor.x += (cursor.tx - cursor.x) * 0.18;
      cursor.y += (cursor.ty - cursor.y) * 0.18;
      cursor.amt += (cursor.tAmt - cursor.amt) * 0.12;
      draw();
      raf = requestAnimationFrame(loop);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        build();
        draw();
      }, 150);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(wrap);

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      cursor.tx = e.clientX - rect.left;
      cursor.ty = e.clientY - rect.top;
      cursor.tAmt = 1;
    };
    const onLeave = () => {
      cursor.tAmt = 0;
    };
    // the site's theme toggle flips `.dark` on <html> live, no remount —
    // watch it so the glyph color updates without a page reload
    const mo = new MutationObserver(() => {
      readTokens();
      if (sized) buildWash(coarsePxStored);
      draw();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const onVis = () => {
      if (!document.hidden && !reduced && ready) raf = requestAnimationFrame(loop);
    };

    // rasterize only once the mono webfont is loaded — a fallback-font
    // measurement would bake in the wrong subdivision count
    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      build();
      ready = true;
      draw();
      if (!reduced) raf = requestAnimationFrame(loop);
    });

    window.addEventListener("resize", onResize);
    canvas.addEventListener("pointermove", onPointer);
    canvas.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [headline, filler, lensRadius]);

  return (
    <div ref={wrapRef} className={`relative w-full ${className}`}>
      <canvas ref={canvasRef} aria-hidden className="block w-full text-foreground" />
      <span className="sr-only">{headline}</span>
    </div>
  );
}
