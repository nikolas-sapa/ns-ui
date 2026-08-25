"use client";

// LoaderAsciiDiffuseFill — an indeterminate loader whose ASCII texture comes
// from real Floyd-Steinberg SERPENTINE error diffusion, not a fixed
// ordered-dither threshold matrix. The registry already ships an
// ordered-dither family (chart-bar-dither, chart-line-dither,
// chart-radar-dither, masonry-ascii-settle, background-ascii-dither) —
// every one of those quantizes a value by comparing it against a repeating
// 4x4 Bayer matrix, a fixed spatial pattern whose outcome at a cell never
// depends on its neighbours. This component is the family's
// PROPAGATED-ERROR member: each cell's quantization error (its true
// continuous value minus the nearest of the 10 ramp levels) is diffused
// into unprocessed neighbours with the canonical Floyd-Steinberg kernel —
// 7/16 forward, 3/16 down-behind, 5/16 down, 1/16 down-ahead — and the scan
// direction alternates every row (serpentine) so the propagation itself
// alternates instead of compounding one directional streak. That
// cell-to-cell coupling is what gives real error diffusion its signature:
// directional, frame-coherent artifact drift, categorically different from
// a repeating threshold tile. It's a real, citable distinction in
// dithering literature (ordered/Bayer vs. error-diffusion/Floyd-Steinberg),
// not a restyle of the existing family.
//
// The "fill" is a soft boundary sweeping continuously across the grid,
// cyclic and never pointer-gated: it wraps and re-enters from the left
// forever, because this is an indeterminate loader, not a completion bar.
// A low-amplitude flowing noise field is summed into every cell's value
// BEFORE quantization, so the diffusion pattern itself drifts frame to
// frame — not just the boundary's position — and both the filled and
// unfilled regions keep visible grain rather than settling flat. The full
// 2D value field is rebuilt and re-diffused from scratch every frame; there
// is no dither state carried over between frames, matching how the
// algorithm actually works on a value field rather than accumulating a
// trail.

import { useEffect, useLayoutEffect, useRef } from "react";

const RAMP = " .:-=+*#%@";
const LEVELS = RAMP.length; // 10 quantization levels

// canonical Floyd-Steinberg coefficients, out of 16
const FS_FWD = 7 / 16;
const FS_DL = 3 / 16;
const FS_D = 5 / 16;
const FS_DR = 1 / 16;

const SWEEP_SPEED = 5.2; // cols/sec the fill boundary advances
const BAND = 3; // soft-edge half-width, in cells, either side of the boundary
const MIN_CELLS_SHORT = 11; // cells guaranteed across the container's shorter dimension
const MIN_CELL_PX = 6;
const MAX_CELL_PX = 15;
// reduced-motion freeze: boundary parked ~46% across (mid-fill, so filled
// ink, unfilled paper AND the diffusion turbulence at the seam are all on
// screen at once) at a fixed nonzero time phase, so the noise term isn't
// sitting on the degenerate all-zero frame every sine in flow() shares at t=0
const STATIC_FRONT_FRAC = 0.46;
const STATIC_T = 3.7;

interface Tokens {
  fg: string;
}

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  // no fallback literal: an empty read means "don't know the ink colour
  // yet" and the paint path below guards on that rather than defaulting to
  // a hardcoded value that could bake in the wrong theme's polarity
  return { fg: cs.getPropertyValue("--foreground").trim() };
}

// cheap flowing value-noise: three summed sines at different rates/scales,
// normalized to 0..1 — same family as background-ascii-dither's noise(),
// just fewer octaves since this only needs to nudge the field, not carry it
function flow(x: number, y: number, t: number): number {
  const v = Math.sin(x * 0.6 + t * 0.5) + Math.sin(y * 0.9 - t * 0.35) + Math.sin((x + y) * 0.4 + t * 0.2);
  return v / 6 + 0.5;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export interface LoaderAsciiDiffuseFillProps {
  /** accessible label for the progressbar */
  "aria-label"?: string;
  /** extra classes merged onto the rendered root element — size it here (e.g. "h-20 w-64"); the canvas fills whatever box it's given */
  className?: string;
}

export function LoaderAsciiDiffuseFill({
  "aria-label": ariaLabel = "Loading",
  className = "",
}: LoaderAsciiDiffuseFillProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef("");

  // token derive — synchronous, before first paint, so nothing can ever
  // draw with an empty/default ink color
  useLayoutEffect(() => {
    fgRef.current = readTokens().fg;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let advancePerPx = 0.6; // '@' advance-width / font-size, refined once the mono font is ready
    let cellSize = 10;
    let fontSize = 10;
    let cols = 0;
    let rows = 0;
    let work: Float32Array | null = null;
    let quant: Uint8Array | null = null;
    let visible = true;
    let raf = 0;
    let metricsGen = 0;

    const measureAdvance = () => {
      const gen = ++metricsGen;
      const measure = () => {
        if (gen !== metricsGen) return;
        const off = document.createElement("canvas").getContext("2d");
        if (!off) return;
        const REF = 100;
        off.font = `${REF}px "GeistMono", ui-monospace, monospace`;
        const w = off.measureText("@").width;
        if (w > 0) advancePerPx = w / REF;
        computeGeometry();
      };
      if (document.fonts?.ready) {
        document.fonts.ready.then(measure);
      } else {
        measure();
      }
    };

    const computeGeometry = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const shortDim = Math.min(w, h);
      cellSize = Math.min(MAX_CELL_PX, Math.max(MIN_CELL_PX, Math.floor(shortDim / MIN_CELLS_SHORT)));
      fontSize = cellSize / advancePerPx;
      cols = Math.max(4, Math.floor(w / cellSize));
      rows = Math.max(3, Math.floor(h / cellSize));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(w * dpr);
      canvas.height = Math.ceil(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${fontSize}px "GeistMono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      work = new Float32Array(cols * rows);
      quant = new Uint8Array(cols * rows);
      if (reduced) {
        drawFrame(STATIC_T, STATIC_FRONT_FRAC * cols);
      } else {
        start();
      }
    };

    // fills `into` with the pre-quantization value field: a soft cyclic
    // sweep boundary plus a flowing noise term, present in BOTH the filled
    // and unfilled regions so the diffusion has texture to work on everywhere
    const buildField = (time: number, frontXOverride: number | null, into: Float32Array) => {
      const cyclePx = cols + BAND * 4;
      const frontX = frontXOverride ?? ((time * SWEEP_SPEED) % cyclePx) - BAND * 2;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const d = gx - frontX;
          const filled = 1 - smoothstep(-BAND, BAND, d);
          const n = flow(gx * 0.5, gy * 0.5, time);
          const seamTurbulence = 1 - smoothstep(BAND * 0.4, BAND * 1.6, Math.abs(d));
          const amp = 0.09 + 0.05 * seamTurbulence;
          const base = 0.08 + filled * 0.85;
          into[gy * cols + gx] = Math.min(1, Math.max(0, base + amp * (n - 0.5) * 2));
        }
      }
    };

    // serpentine Floyd-Steinberg: alternates scan direction every row via
    // `dir` (+1 left-to-right, -1 right-to-left) and mirrors the kernel's x
    // offsets through `dir` rather than hardcoding left/right, so both scan
    // legs share one implementation. `field` is mutated in place (that's how
    // the propagated error actually reaches downstream cells); `quantOut`
    // collects the resulting ramp index per cell.
    const diffuse = (field: Float32Array, quantOut: Uint8Array) => {
      for (let gy = 0; gy < rows; gy++) {
        const dir = gy % 2 === 0 ? 1 : -1;
        const xStart = dir === 1 ? 0 : cols - 1;
        const xEnd = dir === 1 ? cols : -1;
        for (let gx = xStart; gx !== xEnd; gx += dir) {
          const idx = gy * cols + gx;
          const old = field[idx];
          const qi = Math.min(LEVELS - 1, Math.max(0, Math.round(old * (LEVELS - 1))));
          const newVal = qi / (LEVELS - 1);
          const err = old - newVal;
          quantOut[idx] = qi;

          const fx = gx + dir; // forward in scan direction: 7/16
          const bxBehind = gx - dir; // down, behind-side of scan: 3/16
          const bxAhead = gx + dir; // down, ahead-side of scan: 1/16
          if (fx >= 0 && fx < cols) field[idx + dir] += err * FS_FWD;
          if (gy + 1 < rows) {
            const rowBelow = (gy + 1) * cols;
            if (bxBehind >= 0 && bxBehind < cols) field[rowBelow + bxBehind] += err * FS_DL;
            field[rowBelow + gx] += err * FS_D;
            if (bxAhead >= 0 && bxAhead < cols) field[rowBelow + bxAhead] += err * FS_DR;
          }
        }
      }
    };

    const paint = (quantOut: Uint8Array) => {
      // guard, not a fallback color: if the token genuinely hasn't been
      // read yet (should be impossible — see the useLayoutEffect note
      // above — but this is the actual defense, not a hardcoded hex) skip
      // the paint rather than draw in an unknown/default ink
      if (!fgRef.current) return;
      const { width, height } = container.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = fgRef.current;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const ch = RAMP[quantOut[gy * cols + gx]];
          if (ch === " ") continue;
          ctx.fillText(ch, gx * cellSize + cellSize / 2, gy * cellSize + cellSize / 2);
        }
      }
    };

    const drawFrame = (time: number, frontXOverride: number | null) => {
      if (!work || !quant || cols === 0 || rows === 0) return;
      buildField(time, frontXOverride, work);
      diffuse(work, quant);
      paint(quant);
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return; // paused: no reschedule, a wake() call restarts it
      drawFrame(now / 1000, null);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (raf || reduced) return;
      raf = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver(computeGeometry);
    ro.observe(container);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible) start();
      },
      { threshold: 0 }
    );
    io.observe(container);

    const onVisibility = () => {
      if (!document.hidden) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        drawFrame(STATIC_T, STATIC_FRONT_FRAC * cols);
      } else {
        start();
      }
    };
    mq.addEventListener("change", onReducedChange);

    const mo = new MutationObserver(() => {
      fgRef.current = readTokens().fg;
      if (reduced) drawFrame(STATIC_T, STATIC_FRONT_FRAC * cols);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

    measureAdvance();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      mq.removeEventListener("change", onReducedChange);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      role="progressbar"
      aria-label={ariaLabel}
      className={`relative block overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} aria-hidden className="block h-full w-full" />
    </div>
  );
}
