"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// AttributeClash404 — the ZX Spectrum's colour-cell attribute clash, ported
// to a monochrome glyph grid. Real Spectrum hardware split the screen into
// 8x8-pixel cells that could each carry only ONE ink/paper colour pair; any
// image content with finer detail than that budget forced the whole cell to
// snap to a single winner, and the loser's colour bled/blocked wherever it
// lost. There is no hue here, so the translated budget is ONE glyph+weight
// pair per cell instead of one colour pair — the artifact is the same shape:
// wherever the underlying "404" glyph shape needs sub-cell resolution (every
// curved edge of the numerals), the cell is forced to snap fully toward
// "ink" or fully toward "paper", and the digits visibly block and bleed at
// their own edges. This is the joke made mechanical, not a decorative
// filter — a normal glyph-density field (see background-ascii-plasma) always
// renders as much detail as its grid allows; this one is built to render
// LESS than the field wants and show the seam.
//
// The "attribute RAM racing the beam" line in the brief is translated as a
// literal rolling scanline: each frame only the handful of rows the beam
// has newly crossed get their ink/paper decision recomputed from the
// current field time, so the rows just above the beam are fresh and the
// rows still waiting below hold a slightly older decision — a rolling seam
// instead of a single full-field flash (prefers-reduced-motion cares about
// exactly that distinction). Cells that sit near the 50/50 ink/paper split
// (the true clash zone, i.e. numeral edges) additionally get a small
// per-sweep jitter added to their decision threshold, so it is precisely
// the contested cells — never the whole field — that flicker between
// states pass to pass.
//
// Static once per resize: an offscreen "404" raster (read only for alpha,
// any fill colour) is supersampled into a per-cell ink-fraction buffer.
// Dynamic every frame: only the field noise driving glyph choice inside
// each already-decided cell, and the rolling beam that gates when a cell's
// ink/paper decision itself gets re-evaluated. Canvas 2D, direct-DOM rAF,
// no React state on the hot path.
// ---------------------------------------------------------------------------

const SUB = 3; // ink-mask supersample factor per cell, each axis (9 samples/cell)
const MIN_CELL_PX = 8;
const MAX_CELL_PX = 64;
const CLASH_ZONE = 0.62; // clash = 1 - |2*inkFrac-1|; band around the 50/50 edge
const JITTER_AMOUNT = 0.9; // decision-threshold jitter applied only inside CLASH_ZONE
const INK_RAMP = "#%@";
const PAPER_RAMP = " .:-";
const CLASH_RAMP = "*+?";
const STATIC_T = 2.35; // reduced-motion freeze time — see comment at its use below

// small, cheap 2-octave field over grid-index coordinates (not pixels) —
// only needed for glyph *choice* within an already-decided cell and for the
// clash-zone jitter, never for the ink/paper decision itself, which comes
// solely from the static "404" raster.
function fieldValue(gx: number, gy: number, t: number): number {
  const a =
    Math.sin(gx * 0.5 + t * 0.6) +
    Math.sin(gy * 0.5 - t * 0.5) +
    Math.sin((gx + gy) * 0.35 + t * 0.33);
  const b = Math.sin(gx * 1.3 - t * 1.1) + Math.sin(gy * 1.1 + t * 0.9);
  const v = a * 0.6 + b * 0.4;
  return v / 6 + 0.5; // rough-normalize to ~0..1
}

export interface AttributeClash404Props {
  /** target glyph-cell count across the container's smaller dimension */
  cellsAcrossMinDim?: number;
  /** ms for one full top-to-bottom beam pass */
  sweepMs?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function AttributeClash404({
  cellsAcrossMinDim = 26,
  sweepMs = 1100,
  className = "",
}: AttributeClash404Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let fg = "";
    let muted = "";
    let cellW = 0;
    let cellH = 0;
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let fontFamily = "monospace";
    let fontBold = "";
    let fontReg = "";

    // static per resize/fonts-ready: the "404" glyph's own required detail
    let inkFraction = new Float32Array(0);
    // dynamic, gated by the beam sweep below
    let charBuf = new Uint8Array(0); // char code per cell
    let alphaBuf = new Float32Array(0);
    let boldBuf = new Uint8Array(0);

    let sized = false;
    let ready = false;
    let disposed = false;
    let raf = 0;
    let last = 0;
    let t = 0;
    let beamAcc = 0; // unwrapped cumulative row position of the beam
    let visible = true;

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = cs.getPropertyValue("--foreground").trim();
      muted = cs.getPropertyValue("--ns-muted").trim();
    };

    const buildInkMask = () => {
      if (cols < 1 || rows < 1) return;
      const off = document.createElement("canvas");
      off.width = cols * SUB;
      off.height = rows * SUB;
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.clearRect(0, 0, off.width, off.height);
      octx.fillStyle = "#000"; // alpha channel only is read below, fill colour is irrelevant
      octx.textAlign = "center";
      octx.textBaseline = "middle";

      // fit "404" to the offscreen raster with a real margin on each side —
      // never let the numeral shape run edge-to-edge, and never shrink it
      // below legibility either
      let fontPx = off.height * 0.72;
      octx.font = `900 ${fontPx}px ${fontFamily}`;
      const maxW = off.width * 0.86;
      const w0 = octx.measureText("404").width;
      if (w0 > maxW) fontPx *= maxW / w0;
      octx.font = `900 ${fontPx}px ${fontFamily}`;
      octx.fillText("404", off.width / 2, off.height / 2);

      const data = octx.getImageData(0, 0, off.width, off.height).data;
      const frac = new Float32Array(cols * rows);
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          let sum = 0;
          for (let sy = 0; sy < SUB; sy++) {
            const py = gy * SUB + sy;
            for (let sx = 0; sx < SUB; sx++) {
              const px = gx * SUB + sx;
              sum += data[(py * off.width + px) * 4 + 3]; // alpha channel
            }
          }
          frac[gy * cols + gx] = sum / (SUB * SUB * 255);
        }
      }
      inkFraction = frac;
    };

    const measureCell = () => {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return 1;
      octx.font = `700 ${cellH}px ${fontFamily}`;
      return Math.max(4, octx.measureText("MM").width / 2);
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
        : Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      fontFamily = getComputedStyle(canvas).fontFamily;
      const minDim = Math.min(width, height);
      const target = minDim / cellsAcrossMinDim;
      cellH = Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, target));
      cellW = measureCell();
      fontBold = `700 ${cellH}px ${fontFamily}`;
      fontReg = `400 ${cellH}px ${fontFamily}`;

      cols = Math.max(1, Math.ceil(width / cellW));
      rows = Math.max(1, Math.ceil(height / cellH));
      const n = cols * rows;
      charBuf = new Uint8Array(n);
      alphaBuf = new Float32Array(n);
      boldBuf = new Uint8Array(n);
      buildInkMask();
      beamAcc = 0;
      sized = true;
    };

    // recompute one row's ink/paper decision + glyph choice at time `tt` —
    // this is the ONLY place a cell's attribute pair is re-decided; the
    // beam sweep below gates how often that happens per row
    const updateRow = (gy: number, tt: number) => {
      const base = gy * cols;
      for (let gx = 0; gx < cols; gx++) {
        const i = base + gx;
        const inkFrac = inkFraction[i] ?? 0;
        const clash = 1 - Math.abs(inkFrac * 2 - 1);
        const field = fieldValue(gx, gy, tt);
        const jitter = clash > CLASH_ZONE ? (field - 0.5) * JITTER_AMOUNT : 0;
        const bold = inkFrac + jitter >= 0.5;
        let ramp: string;
        if (clash > CLASH_ZONE) ramp = CLASH_RAMP;
        else if (bold) ramp = INK_RAMP;
        else ramp = PAPER_RAMP;
        const ci = Math.min(
          ramp.length - 1,
          Math.floor(field * ramp.length)
        );
        charBuf[i] = ramp.charCodeAt(ci);
        boldBuf[i] = bold ? 1 : 0;
        alphaBuf[i] = bold ? 0.55 + 0.45 * field : 0.12 + 0.28 * field;
      }
    };

    const drawAll = () => {
      if (!sized) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = fg;
      let i = 0;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++, i++) {
          const a = alphaBuf[i];
          if (a <= 0.01) continue;
          ctx.globalAlpha = a;
          ctx.font = boldBuf[i] ? fontBold : fontReg;
          ctx.fillText(
            String.fromCharCode(charBuf[i]),
            gx * cellW + cellW / 2,
            gy * cellH + cellH / 2
          );
        }
      }
      ctx.globalAlpha = 1;

      if (!reduced) {
        // faint racing-beam line — structural readout of the mechanism,
        // never accent (this is ambient, not interaction chrome)
        const beamRow = beamAcc % rows;
        ctx.strokeStyle = muted;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const y = beamRow * cellH;
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;

      const rowsPerSec = rows / (sweepMs / 1000);
      const prevFloor = Math.floor(beamAcc);
      beamAcc += rowsPerSec * dt;
      const newFloor = Math.floor(beamAcc);
      const steps = Math.min(newFloor - prevFloor, rows);
      for (let k = 1; k <= steps; k++) {
        updateRow((prevFloor + k) % rows, t);
      }
      if (beamAcc >= rows * 2) beamAcc -= rows; // keep the accumulator bounded

      drawAll();
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (ready) {
          if (reduced) {
            for (let gy = 0; gy < rows; gy++) updateRow(gy, STATIC_T);
            drawAll();
          } else {
            for (let gy = 0; gy < rows; gy++) updateRow(gy, t);
          }
        }
      }, 150);
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !reduced && ready && !document.hidden) {
          last = 0;
          raf = requestAnimationFrame(loop);
        }
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    const onVis = () => {
      if (!document.hidden && !reduced && ready && visible) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced && ready) drawAll();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // ink mask depends on the resolved mono/sans font metrics, so wait for
    // the webfont before the first raster + measurement pass
    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      ready = true;
      if (reduced) {
        // Freeze on a full completed sweep (every row decided once) at a
        // fixed, non-zero field time rather than t=0: the ink/paper split
        // itself is static (it comes only from the "404" raster), but the
        // glyph choice inside each already-decided cell and the jitter
        // that marks the clash-zone cells both depend on field time, and
        // t=0 is a degenerate phase where several of the field's summed
        // sine terms start at exactly zero. STATIC_T=2.35 lands mid-cycle
        // so clash-zone cells show a spread of ink/paper snap decisions
        // instead of all agreeing — the single frame with the most visible
        // block/bleed structure. No rAF, no beam sweep, no pointer.
        for (let gy = 0; gy < rows; gy++) updateRow(gy, STATIC_T);
        drawAll();
      } else {
        for (let gy = 0; gy < rows; gy++) updateRow(gy, 0);
        raf = requestAnimationFrame(loop);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellsAcrossMinDim, sweepMs]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`block h-full w-full font-mono ${className}`}
    />
  );
}
