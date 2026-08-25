"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// BrailleOrbit — a small ambient icon for empty states: one unbroken stroke
// traced through Unicode braille's 2x4 sub-cell dot addressing along a closed
// 3:2 Lissajous curve. Braille's real discriminating property over any other
// density-ramp glyph is that 2x4 addressable sub-grid — a one-dot-wide curve
// at 4x the resolution a single glyph-per-cell ramp can give. Distinct from
// loader-braille, which spends the same dot grid on a 1D bar/progress fill (a
// tone); this spends it on a 2D trajectory instead.
//
// Curve is sampled by ARC LENGTH, never a fixed time-step: each new point is
// found by bisecting the step size in curve-parameter `t` until it lands
// within MAX_ARC_DOT dot-units of the previous point, so no two consecutive
// dots ever gap by more than one dot — fixed-t sampling would gap at high
// curvature and cluster at low curvature. A ~140-sample ring buffer of the
// most recent points carries the trail; each is mapped to its glyph cell and
// sub-dot bit every frame, giving a comet read (bright head, fading tail)
// rather than a fully-lit static loop.
//
// Head-to-tail fade is an ALPHA ramp on foreground-colored glyphs, never
// arithmetic on the token color strings: every lit cell is drawn once in
// --ns-muted at full alpha (the base), then again in --foreground at an
// alpha equal to the freshest sample that touched it — near the head that
// second pass is near-opaque and fully covers the base, near the tail it's
// near-transparent and lets the muted base show through untouched. Works
// unmodified if a token is ever redefined as non-grayscale.
//
// Amplitude eases 0->full once on mount over 1.2s ease-out-expo (the one
// damped moment); after that the orbit is a steady, undamped, energy-
// conserving loop that never settles or repeats within any short window
// (period ~27s). Same offscreen-measureText/document.fonts.ready cell-metric
// convention as the rest of the ascii family, tokens via getComputedStyle +
// a MutationObserver on documentElement's class, one rAF loop paused on
// visibilitychange. Purely decorative: aria-hidden, no accent, no
// interaction.
// ---------------------------------------------------------------------------

// Unicode braille dot bit, indexed [subRow 0-3][subCol 0-1] within a cell's
// 2x4 sub-grid (dot1=0x01 .. dot8=0x80, canonical U+2800 layout).
const DOT_BIT: readonly (readonly [number, number])[] = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
];

const FREQ_X = 0.35; // rad/s
const FREQ_Y = 0.233; // rad/s — 0.35:0.233 gives the closed 3:2 Lissajous
const AMP_FRAC = 0.35; // amplitude as a fraction of the grid box dimension
const RAMP_S = 1.2; // amplitude ease-in duration, seconds
const RING_SIZE = 140;
const MAX_ARC_DOT = 0.6; // max dot-unit distance between consecutive samples
const MAX_EMITS_PER_FRAME = 80; // safety cap, not expected to bind at 60fps
const MAX_STEP_T = 0.5; // ceiling on the arc-march step guess, seconds
const DT_MAX = 0.05;
const REDUCED_ARC_DOTS = 90;
const REDUCED_START_T = 0.9; // clear of the axis crossing near t=0

function easeOutExpo(x: number): number {
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

export interface BrailleOrbitProps {
  /** braille glyph cell size in px */
  cellSize?: number;
  /** icon box size in px (square) */
  size?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function BrailleOrbit({ cellSize = 14, size = 120, className = "" }: BrailleOrbitProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fg = "currentColor";
    let muted = "currentColor";
    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let sized = false;
    let ready = false;
    let disposed = false;

    // curve geometry, set on resize
    let cx = 0;
    let cy = 0;
    let ampX = 0;
    let ampY = 0;
    let dotPitchX = 1;
    let dotPitchY = 1;
    let dotCols = 0;
    let dotRows = 0;

    // per-cell scratch, rebuilt every frame from the ring buffer
    let cellMask: Uint8Array = new Uint8Array(0);
    let cellWeight: Float32Array = new Float32Array(0);

    // ring buffer of trailing curve samples (px space, cheapest to store)
    const ringX = new Float32Array(RING_SIZE);
    const ringY = new Float32Array(RING_SIZE);
    let ringHead = 0;
    let ringCount = 0;

    let hasEmitted = false;
    let lastEmitT = 0;
    let lastEmitX = 0;
    let lastEmitY = 0;
    let marchGuessDT = 0.25;

    const readTokens = () => {
      const s = getComputedStyle(document.documentElement);
      fg = s.getPropertyValue("--foreground").trim() || "currentColor";
      muted = s.getPropertyValue("--ns-muted").trim() || fg;
    };

    const measureCell = (fontFamily: string) => {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.font = `${cellSize}px ${fontFamily}`;
      cellW = Math.max(4, octx.measureText("MMMMMMMMMM").width / 10);
      cellH = cellSize;
    };

    // position on the closed 3:2 Lissajous at curve-parameter t (seconds
    // since the loop started); amplitude carries its own one-shot ease-in.
    const scratch = { x: 0, y: 0 };
    const pos = (t: number, out: { x: number; y: number }) => {
      const frac = easeOutExpo(Math.min(1, t / RAMP_S));
      out.x = cx + ampX * frac * Math.sin(FREQ_X * t);
      out.y = cy + ampY * frac * Math.sin(FREQ_Y * t + Math.PI / 2);
    };

    const distDots = (x0: number, y0: number, x1: number, y1: number) => {
      const dx = (x1 - x0) / dotPitchX;
      const dy = (y1 - y0) / dotPitchY;
      return Math.hypot(dx, dy);
    };

    // one arc-length-bounded step from (fromT, fromX, fromY): tries maxStepT,
    // bisects down while the resulting dot-distance exceeds MAX_ARC_DOT.
    const stepArc = (fromT: number, fromX: number, fromY: number, maxStepT: number) => {
      let stepT = maxStepT;
      let candT = fromT + stepT;
      pos(candT, scratch);
      let d = distDots(fromX, fromY, scratch.x, scratch.y);
      let tries = 0;
      while (d > MAX_ARC_DOT && tries < 24) {
        stepT *= 0.5;
        candT = fromT + stepT;
        pos(candT, scratch);
        d = distDots(fromX, fromY, scratch.x, scratch.y);
        tries++;
      }
      return { t: candT, x: scratch.x, y: scratch.y, d, stepT };
    };

    const pushSample = (x: number, y: number) => {
      ringX[ringHead] = x;
      ringY[ringHead] = y;
      ringHead = (ringHead + 1) % RING_SIZE;
      if (ringCount < RING_SIZE) ringCount++;
    };

    // advances the live orbit head to simulation time targetT, emitting as
    // many arc-length-bounded samples as needed to get there.
    const advanceTo = (targetT: number) => {
      if (!hasEmitted) {
        pos(targetT, scratch);
        pushSample(scratch.x, scratch.y);
        lastEmitT = targetT;
        lastEmitX = scratch.x;
        lastEmitY = scratch.y;
        hasEmitted = true;
        marchGuessDT = 0.25;
        return;
      }
      let emits = 0;
      while (emits < MAX_EMITS_PER_FRAME) {
        // the arc-length step is sized by curvature alone, never by how much
        // real time this frame has left — clamping it to targetT-lastEmitT
        // would force one sample per frame regardless of curve speed, which
        // collapses the trail to a handful of frame-spaced points instead of
        // a curve sampled evenly by arc length.
        const r = stepArc(lastEmitT, lastEmitX, lastEmitY, marchGuessDT);
        if (r.t > targetT) break;
        pushSample(r.x, r.y);
        lastEmitT = r.t;
        lastEmitX = r.x;
        lastEmitY = r.y;
        marchGuessDT = r.d < MAX_ARC_DOT * 0.5 ? Math.min(MAX_STEP_T, r.stepT * 1.6) : r.stepT;
        if (marchGuessDT < 1e-4) marchGuessDT = 1e-4;
        emits++;
      }
    };

    // maps one curve point to its glyph cell + sub-dot bit, ORing the bit
    // into that cell's mask and keeping the freshest (max) weight touching it
    const mapPointToCell = (x: number, y: number, weight: number) => {
      let dotCol = Math.floor(x / dotPitchX);
      let dotRow = Math.floor(y / dotPitchY);
      if (dotCol < 0) dotCol = 0;
      else if (dotCol >= dotCols) dotCol = dotCols - 1;
      if (dotRow < 0) dotRow = 0;
      else if (dotRow >= dotRows) dotRow = dotRows - 1;
      const cellCol = dotCol >> 1;
      const cellRow = dotRow >> 2;
      const bit = DOT_BIT[dotRow & 3]![dotCol & 1]!;
      const cellIdx = cellRow * cols + cellCol;
      cellMask[cellIdx]! |= bit;
      if (weight > cellWeight[cellIdx]!) cellWeight[cellIdx] = weight;
    };

    const buildCellsFromRing = () => {
      cellMask.fill(0);
      cellWeight.fill(0);
      const n = ringCount;
      for (let i = 0; i < n; i++) {
        const idx = (ringHead - n + i + RING_SIZE * 2) % RING_SIZE;
        const weight = n <= 1 ? 1 : Math.pow(i / (n - 1), 1.3);
        mapPointToCell(ringX[idx]!, ringY[idx]!, weight);
      }
    };

    const draw = () => {
      if (!sized) return;
      ctx.clearRect(0, 0, width, height);
      // base pass: muted ink at full alpha under every lit cell
      ctx.globalAlpha = 1;
      ctx.fillStyle = muted;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const mask = cellMask[idx]!;
          if (!mask) continue;
          ctx.fillText(String.fromCharCode(0x2800 + mask), c * cellW + cellW / 2, r * cellH + cellH / 2);
        }
      }
      // overlay pass: foreground crossfaded in by per-cell alpha weight —
      // the fade itself, never color-string arithmetic
      ctx.fillStyle = fg;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const mask = cellMask[idx]!;
          if (!mask) continue;
          const w = cellWeight[idx]!;
          if (w <= 0.02) continue;
          ctx.globalAlpha = w;
          ctx.fillText(String.fromCharCode(0x2800 + mask), c * cellW + cellW / 2, r * cellH + cellH / 2);
        }
      }
      ctx.globalAlpha = 1;
    };

    // reduced motion: one baked ~90-dot curved arc, no ring buffer, no rAF.
    // Starts past REDUCED_START_T so the frozen segment sits on a genuinely
    // curved stretch rather than the near-straight run through an axis
    // crossing, which would read as a dead line, not an orbit fragment.
    const drawReducedStatic = () => {
      if (!sized) return;
      pos(REDUCED_START_T, scratch);
      let t = REDUCED_START_T;
      let x = scratch.x;
      let y = scratch.y;
      const ptsX: number[] = [x];
      const ptsY: number[] = [y];
      let guessDT = 0.25;
      while (ptsX.length < REDUCED_ARC_DOTS) {
        const r = stepArc(t, x, y, guessDT);
        t = r.t;
        x = r.x;
        y = r.y;
        ptsX.push(x);
        ptsY.push(y);
        guessDT = r.d < MAX_ARC_DOT * 0.5 ? r.stepT * 1.6 : r.stepT;
        if (guessDT < 1e-4) guessDT = 1e-4;
      }
      cellMask.fill(0);
      cellWeight.fill(0);
      const n = ptsX.length;
      for (let i = 0; i < n; i++) {
        mapPointToCell(ptsX[i]!, ptsY[i]!, Math.pow(i / (n - 1), 1.3));
      }
      draw();
    };

    const resetOrbit = () => {
      ringHead = 0;
      ringCount = 0;
      hasEmitted = false;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
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

      cols = Math.max(4, Math.round(width / cellW));
      rows = Math.max(4, Math.round(height / cellH));
      dotPitchX = cellW / 2;
      dotPitchY = cellH / 4;
      dotCols = cols * 2;
      dotRows = rows * 4;
      cx = (cols * cellW) / 2;
      cy = (rows * cellH) / 2;
      ampX = AMP_FRAC * cols * cellW;
      ampY = AMP_FRAC * rows * cellH;
      cellMask = new Uint8Array(cols * rows);
      cellWeight = new Float32Array(cols * rows);
      resetOrbit();
      sized = true;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) drawReducedStatic();
      }, 150);
    };

    // -- hot-path state -------------------------------------------------------
    let raf = 0;
    let last = 0;
    let simT = 0;

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      simT += dt;
      advanceTo(simT);
      buildCellsFromRing();
      draw();
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
      if (reduced) draw();
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
        drawReducedStatic();
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
  }, [cellSize, size]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`block font-mono ${className}`}
    />
  );
}
