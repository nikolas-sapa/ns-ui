"use client";

import { useEffect, useRef } from "react";

const ASCII_RAMP = " .:-=+*#%@";
// 4x4 Bayer matrix, normalized 0..1
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (v) => (v + 0.5) / 16
);

type Mode = "ascii" | "dither" | "dot";

// cheap flowing value-noise, no deps
function noise(x: number, y: number, t: number): number {
  const v =
    Math.sin(x * 1.7 + t * 0.6) +
    Math.sin(y * 2.3 - t * 0.4) +
    Math.sin((x + y) * 1.1 + t * 0.25) +
    Math.sin(Math.hypot(x - 6, y - 4) * 1.9 - t * 0.7);
  return v / 8 + 0.5; // 0..1
}

export function AsciiDitherMedia({
  mode = "ascii",
  src,
  cellSize = 14,
  cursorRadius = 140,
  className = "",
}: {
  /** rendering style: "ascii" characters, "dither" pattern, or "dot" halftone */
  mode?: Mode;
  /** optional image URL; omit for the built-in animated noise field */
  src?: string;
  /** grid cell size in px */
  cellSize?: number;
  /** cursor-proximity resolve radius in px */
  cursorRadius?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // glyph color from the surrounding theme; canvas bg stays transparent
    let fg = "";
    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
    };
    readTokens();

    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let imageLum: Float32Array | null = null;
    const cursor = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4 };
    let raf = 0;
    let t = 0;
    // bumped on every sampleImage() dispatch so a late-resolving onload from
    // a superseded resize (rapid window-resize) can detect it's stale and
    // bail instead of writing imageLum sized to an out-of-date cols/rows
    let sampleGen = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      cols = Math.ceil(width / cellSize);
      rows = Math.ceil(height / cellSize);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${cellSize * 0.85}px "GeistMono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (src) sampleImage();
    };

    // coalesce bursts of resize events (dragging a window edge fires dozens)
    // into one recompute + one image refetch/redecode
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
      }, 150);
    };

    const sampleImage = () => {
      if (!src) return;
      const gen = ++sampleGen;
      const sampleCols = cols;
      const sampleRows = rows;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (gen !== sampleGen) return; // superseded by a newer resize/sample
        const buf = document.createElement("canvas");
        buf.width = sampleCols;
        buf.height = sampleRows;
        const bctx = buf.getContext("2d");
        if (!bctx) return;
        // cover-fit the image into the grid
        const scale = Math.max(sampleCols / img.width, sampleRows / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        bctx.drawImage(img, (sampleCols - w) / 2, (sampleRows - h) / 2, w, h);
        const data = bctx.getImageData(0, 0, sampleCols, sampleRows).data;
        const lum = new Float32Array(sampleCols * sampleRows);
        for (let i = 0; i < sampleCols * sampleRows; i++) {
          lum[i] =
            (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
        }
        imageLum = lum;
        if (reduced) draw(); // static sources still need one paint
      };
      img.src = src;
    };

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = fg;
      // ease cursor for a trailing resolve
      cursor.x += (cursor.tx - cursor.x) * 0.12;
      cursor.y += (cursor.ty - cursor.y) * 0.12;
      const r2 = cursorRadius * cursorRadius;

      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          // gamma deepens the noise floor: large areas go empty, crests pop.
          // x-advection makes the field travel, not just undulate in place
          let lum = imageLum
            ? imageLum[gy * cols + gx]
            : Math.pow(noise(gx * 0.35 + t * 0.22, gy * 0.35, t), 1.7);
          const px = gx * cellSize + cellSize / 2;
          const py = gy * cellSize + cellSize / 2;
          // gaussian-ish cursor boost
          const dx = px - cursor.x;
          const dy = py - cursor.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < r2 * 4) lum = Math.min(1, lum + Math.exp(-d2 / r2) * 0.7);

          if (mode === "ascii") {
            const ch = ASCII_RAMP[Math.floor(lum * (ASCII_RAMP.length - 1))];
            if (ch !== " ") {
              ctx.globalAlpha = 0.25 + lum * 0.75;
              ctx.fillText(ch, px, py);
            }
          } else if (mode === "dither") {
            if (lum > BAYER[(gy % 4) * 4 + (gx % 4)]) {
              ctx.globalAlpha = 0.9;
              ctx.fillRect(px - 1, py - 1, 2, 2);
            }
          } else {
            const rad = (lum * cellSize) / 2.4;
            if (rad > 0.4) {
              ctx.globalAlpha = 0.3 + lum * 0.7;
              ctx.beginPath();
              ctx.arc(px, py, rad, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      t += 0.028;
      draw();
      raf = requestAnimationFrame(loop);
    };

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      cursor.tx = e.clientX - rect.left;
      cursor.ty = e.clientY - rect.top;
    };
    const onLeave = () => {
      cursor.tx = -1e4;
      cursor.ty = -1e4;
    };

    // theme flip only swaps the .dark class — re-read the ink, no remount
    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    resize();
    window.addEventListener("resize", onResize);
    canvas.addEventListener("pointermove", onPointer);
    canvas.addEventListener("pointerleave", onLeave);
    if (reduced) {
      draw(); // single static frame
    } else {
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [mode, src, cellSize, cursorRadius]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`block h-full w-full text-foreground ${className}`}
    />
  );
}
