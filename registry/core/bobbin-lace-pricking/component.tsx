"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// BobbinLacePricking — a decorative divider/empty-state motif: a narrow
// WORKING BAND of pins works its way down a pricked grid, twisting a pair of
// threads into a locked X at each active pin, while pins two rows behind the
// band are pulled free once their crossing has secured into the growing lace
// ground. Source: bobbin lace (pillow/pricking) construction.
//
// The load-bearing, uncontested part of this mechanic (per spec) is that a
// pin is a TEMPORARY fixture — placed, used, then physically removed as work
// progresses — which is what separates it from every other lattice/mesh
// sibling in the registry (mesh-lash, seep-lattice, pin-register): none of
// those remove a placed element as the pattern advances.
//
// TIMELINE (one continuous clock, no per-pin React state):
//   continuousRow = elapsedMs / ROW_INTERVAL   (smooth fractional row depth)
//   currentRow    = floor(continuousRow)        (the row being actively worked)
//   rowElapsedMs  = fractional part * ROW_INTERVAL
//
// Every row is classified purely by `age = currentRow - rowIndex`:
//   age < 0   not yet reached      -> border-token pricking dot only
//   age == 0  actively crossing    -> pin dot + a per-column-batch twist
//                                     animation (3 batches, 700ms apart,
//                                     850ms twist each, mirroring "3 pins/
//                                     row roughly staggered 700ms" scaled to
//                                     any column count via `col % 3`)
//   age == 1  just secured         -> pin dot + locked X, full strength,
//                                     static (already crossed, not yet pulled)
//   age == 2  pull row             -> exactly one column (cycling every
//                                     interval) animates its pin sliding out
//                                     + fading over 180ms while its locked X
//                                     stays put; every other column in the
//                                     row still shows a plain locked X + dot
//   age >= 3  finished ground      -> locked X only, no pin dot (already
//                                     pulled), rendered at low-moderate
//                                     opacity, never re-animated
//
// Exactly one row has age===2 at any instant, so exactly one pull event is
// ever in flight — the single, unmistakable "old pin behind the band" cue
// the spec names as the ONE thing to follow, on a ~2.6s cadence well above
// the ~1s legibility floor.
//
// The whole field scrolls continuously (band pinned at a fixed screen
// fraction, rows drift upward under it), so the loop never simply stops —
// new pricking keeps entering from the bottom, matching the spec's
// unbounded-scrolling-field option.
// ---------------------------------------------------------------------------

const ROW_INTERVAL_MS = 2600; // one full working-band row advance
const CROSS_MS = 850; // per-pin twist-and-lock duration
const BATCH_STAGGER_MS = 700; // stagger between the 3 within-row batches
const PULL_MS = 180; // pin slide-out + fade duration
const BAND_Y_FRAC = 1 / 3; // active row's screen position, fraction of height
const MIN_PITCH = 12;
const MAX_PITCH = 20;
const TARGET_PINS_ACROSS = 10; // used to derive pitch from the smaller dimension
const FINISHED_ALPHA = 0.38; // low-moderate opacity for set lace ground
const CROSS_HALF_LEN = 0.42; // fraction of pitch, half-length of each thread stroke
const STATIC_ROW = 3; // reduced-motion: currentRow at freeze
const STATIC_ROW_ELAPSED = 375; // ms into that row -> mid-cross on batch 0

function easeOutCubic(x: number): number {
  const t = 1 - x;
  return 1 - t * t * t;
}

export interface BobbinLacePrickingProps {
  className?: string;
}

export function BobbinLacePricking({ className = "" }: BobbinLacePrickingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fg = "currentColor";
    let border = "currentColor";
    let width = 0;
    let height = 0;
    let dpr = 1;
    let sized = false;
    let disposed = false;
    let visible = true;

    let pitch = 16;
    let cols = 0;
    let bandScreenY = 0;

    const readTokens = () => {
      const s = getComputedStyle(document.documentElement);
      fg = s.getPropertyValue("--foreground").trim() || "currentColor";
      border = s.getPropertyValue("--border").trim() || fg;
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

      const smaller = Math.min(width, height);
      pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, smaller / TARGET_PINS_ACROSS));
      cols = Math.max(2, Math.floor(width / pitch));
      bandScreenY = height * BAND_Y_FRAC;
      sized = true;
    };

    // Two strokes rotating from parallel (theta=0) to a locked X (theta=45deg)
    // around (cx, cy), eased. `full` (age>=1) draws the settled X directly.
    const drawTwist = (cx: number, cy: number, progress: number, alpha: number) => {
      const eased = easeOutCubic(Math.min(1, Math.max(0, progress)));
      const theta = (eased * 45 * Math.PI) / 180;
      const len = pitch * CROSS_HALF_LEN;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      // thread A: rotates clockwise from vertical
      ctx.beginPath();
      ctx.moveTo(cx - Math.sin(theta) * len, cy - Math.cos(theta) * len);
      ctx.lineTo(cx + Math.sin(theta) * len, cy + Math.cos(theta) * len);
      ctx.stroke();
      // thread B: rotates counter-clockwise from vertical
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(theta) * len, cy - Math.cos(theta) * len);
      ctx.lineTo(cx - Math.sin(theta) * len, cy + Math.cos(theta) * len);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const drawPinDot = (cx: number, cy: number, alpha: number, radius: number) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const drawHole = (cx: number, cy: number) => {
      ctx.globalAlpha = 1;
      ctx.fillStyle = border;
      ctx.beginPath();
      ctx.arc(cx, cy, 1, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawField = (continuousRow: number) => {
      if (!sized) return;
      ctx.clearRect(0, 0, width, height);

      const currentRow = Math.floor(continuousRow);
      const rowElapsedMs = (continuousRow - currentRow) * ROW_INTERVAL_MS;
      const pullCol = ((currentRow % cols) + cols) % cols;
      const pullProgress = Math.min(1, Math.max(0, rowElapsedMs / PULL_MS));

      const minRow = Math.floor(continuousRow + (0 - bandScreenY) / pitch) - 1;
      const maxRow = Math.ceil(continuousRow + (height - bandScreenY) / pitch) + 1;

      for (let rowIndex = Math.max(0, minRow); rowIndex <= maxRow; rowIndex++) {
        const age = currentRow - rowIndex;
        const cy = bandScreenY + (rowIndex - continuousRow) * pitch;
        const xOffset = (rowIndex % 2) * (pitch / 2);

        for (let col = 0; col < cols; col++) {
          const cx = xOffset + col * pitch + pitch / 2;
          if (cx > width + pitch) continue;

          if (age < 0) {
            drawHole(cx, cy);
            continue;
          }

          if (age === 0) {
            const batch = col % 3;
            const batchStart = batch * BATCH_STAGGER_MS;
            const localProgress = (rowElapsedMs - batchStart) / CROSS_MS;
            if (localProgress <= 0) {
              drawPinDot(cx, cy, 1, 1.5);
            } else {
              drawTwist(cx, cy, localProgress, 1);
              drawPinDot(cx, cy, 1, 1.5);
            }
            continue;
          }

          if (age === 1) {
            drawTwist(cx, cy, 1, 1);
            drawPinDot(cx, cy, 1, 1.5);
            continue;
          }

          if (age === 2) {
            drawTwist(cx, cy, 1, 1);
            if (col === pullCol) {
              const slideY = -6 * easeOutCubic(pullProgress);
              const dotAlpha = 1 - pullProgress;
              if (dotAlpha > 0.01) drawPinDot(cx, cy + slideY, dotAlpha, 1.5);
            } else {
              drawPinDot(cx, cy, 1, 1.5);
            }
            continue;
          }

          // age >= 3: finished ground, pin long since pulled
          drawTwist(cx, cy, 1, FINISHED_ALPHA);
        }
      }
    };

    let raf = 0;
    let startTime = 0;

    const loop = (now: number) => {
      if (!startTime) startTime = now;
      const continuousRow = (now - startTime) / ROW_INTERVAL_MS;
      drawField(continuousRow);
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    const drawReducedStatic = () => {
      const continuousRow = STATIC_ROW + STATIC_ROW_ELAPSED / ROW_INTERVAL_MS;
      drawField(continuousRow);
    };

    const start = () => {
      if (reduced) {
        drawReducedStatic();
        return;
      }
      startTime = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) drawReducedStatic();
      }, 120);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && !reduced) start();
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    const onVis = () => {
      if (!document.hidden && visible && !reduced) start();
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced && sized) drawReducedStatic();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    readTokens();
    resize();
    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      void disposed;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`block h-full w-full ${className}`}
    />
  );
}
