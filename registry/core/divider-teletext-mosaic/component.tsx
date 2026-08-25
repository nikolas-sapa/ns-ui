"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// DividerTeletextMosaic — a full-width section divider rendered as a
// teletext / videotex ALPHAMOSAIC graphics band.
//
// Real broadcast teletext (World System Teletext / CEEFAX-era) never had a
// per-pixel framebuffer: each character cell is a 6-bit code selecting one
// of 64 patterns across a fixed 2-wide x 3-tall sub-cell grid ("sextant"
// addressing — top-left, top-right, mid-left, mid-right, bottom-left,
// bottom-right). That is a genuinely different sub-cell grid from anything
// else in this registry: block-element dividers quantize 2x2 quadrants,
// braille components address a 2x4 dot grid — this is 2x3, the real
// alphamosaic grid a teletext decoder actually drew, contiguous (no gaps
// between sub-cells, matching the "contiguous mosaic" mode broadcasters used
// for photo-like graphics, as opposed to "separated mosaic" which insets a
// gap per block).
//
// Sub-cells are rendered as filled canvas rects, not the Unicode sextant
// block range (U+1FB00-U+1FB3B, "Symbols for Legacy Computing") — this
// repo's mono stack (GeistMono / GeistMono Fallback / ui-monospace) does not
// carry that range, and shipping unverified glyph coverage risks silent
// tofu. Drawing the six sub-cells directly is also what a real teletext
// decoder chip did: it never asked a font for a glyph, it lit sub-cell
// segments off the 6-bit code.
//
// ALIVE AT REST: a real teletext page doesn't arrive all at once — rows
// paint in one at a time as they're received off the broadcast VBI signal.
// This band reproduces that: a write cursor sweeps top-to-bottom on a fixed
// cadence, re-sampling a slow generative field into a fresh 6-bit pattern
// per cell each time a row's turn comes, then holds that content until the
// next pass. A short sync pause follows a full pass before the page
// "refreshes" again, mirroring the real per-page transmission cycle.
// ---------------------------------------------------------------------------

const ROWS = 6; // character rows in the band
const ROW_INTERVAL_MS = 420; // time between successive row writes ("as received")
const PAUSE_MS = 600; // sync pause between a completed pass and the next
const FLASH_MS = 220; // dwell of the just-written row's highlight hairline
const DITHER_STRENGTH = 0.32; // ordered-dither spread around the 0.5 threshold

// 2x3 ordered-dither bias table, one entry per sub-cell index
// (subRow*2 + subCol), scattered rather than linear so the threshold band
// doesn't read as a simple diagonal — the same discipline real videotex
// picture-mosaic dithering used to fake tone out of a binary grid.
const DITHER_ORDER = [0, 3, 4, 1, 2, 5];
const DITHER_BIAS = DITHER_ORDER.map((k) => (k + 0.5) / 6 - 0.5);

function fieldValue(sx: number, sy: number, t: number) {
  // three non-commensurate traveling components summed and normalized —
  // enough structure to read as a low-res broadcast picture once
  // sextant-quantized, and slow enough that a 420ms row-write cadence
  // samples visibly different content on every pass.
  const f =
    Math.sin(sx * 0.35 + t * 0.9) +
    0.6 * Math.sin(sy * 0.6 - sx * 0.12 + t * 0.53) +
    0.4 * Math.sin((sx + sy) * 0.22 + t * 0.31);
  const v = (f + 2) / 4; // amplitude sum is +/-2 -> 0..1
  return Math.pow(Math.min(1, Math.max(0, v)), 1.2);
}

function subCellPattern(colGlobal: number, row: number, t: number) {
  // returns a 6-bit mask, bit i = sub-cell i (0=top-left ... 5=bottom-right)
  let bits = 0;
  for (let subRow = 0; subRow < 3; subRow++) {
    for (let subCol = 0; subCol < 2; subCol++) {
      const idx = subRow * 2 + subCol;
      const sx = colGlobal * 2 + subCol;
      const sy = row * 3 + subRow;
      const v = fieldValue(sx, sy, t);
      const threshold = 0.5 + DITHER_BIAS[idx] * DITHER_STRENGTH;
      if (v > threshold) bits |= 1 << idx;
    }
  }
  return bits;
}

export interface DividerTeletextMosaicProps {
  /** cell size in px; row height. Cell width is derived from monospace metrics. Default 14. */
  cellSize?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function DividerTeletextMosaic({
  cellSize = 14,
  className = "",
}: DividerTeletextMosaicProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fg = "currentColor";
    let cellW = cellSize * 0.6;
    const cellH = cellSize;
    let cols = 0;
    let sized = false;
    let disposed = false;

    // per-cell state: pattern (6-bit) and the timestamp (ms, component-local
    // clock) it was last written, for the write-flash hairline
    let patterns: Uint8Array[] = [];
    let writeAt: Float32Array[] = [];

    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
    };

    const allocRows = () => {
      patterns = Array.from({ length: ROWS }, () => new Uint8Array(cols));
      writeAt = Array.from({ length: ROWS }, () => new Float32Array(cols).fill(-Infinity));
    };

    // globalT: seconds, drives the generative field. Never resets — content
    // keeps evolving pass over pass so no two page loads look identical.
    let globalT = 0;
    // step machine: stepIndex 0..ROWS-1 writes that row, stepIndex===ROWS is
    // the sync pause; stepAcc accumulates ms toward the current step's
    // duration, same accumulator discipline as the sibling VU divider.
    let stepIndex = 0;
    let stepAcc = 0;

    const stepDuration = (i: number) => (i < ROWS ? ROW_INTERVAL_MS : PAUSE_MS);

    const writeRow = (row: number) => {
      if (!sized) return;
      for (let c = 0; c < cols; c++) {
        patterns[row][c] = subCellPattern(c, row, globalT);
        writeAt[row][c] = globalT;
      }
    };

    // full pass at increasing globalT, used both for the initial warm start
    // (a page never opens as a blank cell grid) and after a resize (a new
    // column count leaves nothing painted otherwise)
    const warmPass = () => {
      for (let r = 0; r < ROWS; r++) {
        globalT += ROW_INTERVAL_MS / 1000;
        writeRow(r);
      }
      stepIndex = 0;
      stepAcc = 0;
    };

    const resize = () => {
      const { width } = canvas.getBoundingClientRect();
      const height = ROWS * cellH;
      if (width < 2) {
        sized = false;
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const fontFamily = getComputedStyle(canvas).fontFamily;
      const off = document.createElement("canvas").getContext("2d");
      if (off) {
        off.font = `${cellSize}px ${fontFamily}`;
        cellW = Math.max(6, off.measureText("MMMMMMMMMM").width / 10);
      }

      cols = Math.max(8, Math.floor(width / cellW));
      sized = true;
      allocRows();
      warmPass();
    };

    const draw = () => {
      if (!sized) return;
      ctx.clearRect(0, 0, cols * cellW + cellW, ROWS * cellH);
      ctx.fillStyle = fg;

      const subW = cellW / 2;
      const subH = cellH / 3;

      for (let r = 0; r < ROWS; r++) {
        const rowPatterns = patterns[r];
        const rowWriteAt = writeAt[r];
        for (let c = 0; c < cols; c++) {
          const bits = rowPatterns[c];
          if (bits === 0) continue;
          const x = c * cellW;
          const y = r * cellH;
          for (let subRow = 0; subRow < 3; subRow++) {
            for (let subCol = 0; subCol < 2; subCol++) {
              const idx = subRow * 2 + subCol;
              if (!(bits & (1 << idx))) continue;
              ctx.fillRect(
                Math.round(x + subCol * subW),
                Math.round(y + subRow * subH),
                Math.ceil(subW) + 1,
                Math.ceil(subH) + 1
              );
            }
          }
          if (!reduced) {
            const age = (globalT - rowWriteAt[c]) * 1000;
            if (age >= 0 && age < FLASH_MS) {
              const alpha = 1 - age / FLASH_MS;
              ctx.globalAlpha = alpha * 0.6;
              ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(cellW) + 1, 1);
              ctx.globalAlpha = 1;
            }
          }
        }
      }
    };

    // -- loop ----------------------------------------------------------------
    let raf = 0;
    let last = 0;

    const loop = (now: number) => {
      const dtMs = last ? Math.min(250, now - last) : 1000 / 60;
      last = now;
      globalT += dtMs / 1000;
      stepAcc += dtMs;

      let guard = 0;
      while (stepAcc >= stepDuration(stepIndex) && guard < ROWS + 1) {
        stepAcc -= stepDuration(stepIndex);
        if (stepIndex < ROWS) writeRow(stepIndex);
        stepIndex = (stepIndex + 1) % (ROWS + 1);
        guard++;
      }

      draw();
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        draw();
      }, 150);
    };
    window.addEventListener("resize", onResize);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced && sized) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();

      if (reduced) {
        // freeze on a deliberately non-t0 frame: run the row-write sweep
        // forward through one full extra pass past the warm start, so
        // every row has been freshly rewritten at least twice and the
        // mosaic is at its most legible full-page state — never the sync
        // pause (which, while not empty, is the least eventful frame) and
        // never t0's cold warm-fill.
        for (let r = 0; r < ROWS; r++) {
          globalT += ROW_INTERVAL_MS / 1000;
          writeRow(r);
        }
        draw();
        return;
      }

      draw();
      raf = requestAnimationFrame(loop);
    });

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
    <div
      role="separator"
      aria-orientation="horizontal"
      className={`ns-dtm w-full font-mono ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block w-full text-foreground"
        style={{ height: ROWS * cellSize }}
      />
    </div>
  );
}
