"use client";

import { useEffect, useRef } from "react";

const ASCII_RAMP = " .:-=+*#%@";

// Built-in 5x7 block font: uppercase A-Z, 0-9, space, "-", ".", "!". Each
// glyph is 7 rows of a 5-bit string, MSB-first, top row first. Deliberately
// hand-drawn geometric shapes, not a traced copy of any real bitmap font —
// good enough to read as block type, not meant to be typographically exact.
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
};

const GLYPH_W = 5;
const GLYPH_H = 7;
const GLYPH_GAP = 1; // blank columns between letters

export interface GlyphCastProps {
  /** headline text; unsupported characters render as a blank cell */
  text: string;
  /** cursor-proximity light radius in px, at the canvas's own pixel scale */
  cursorRadius?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function GlyphCast({
  text,
  cursorRadius = 120,
  className = "",
}: GlyphCastProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const chars = Array.from(text.toUpperCase());
    const cols = chars.length * GLYPH_W + Math.max(0, chars.length - 1) * GLYPH_GAP;
    const rows = GLYPH_H;

    // resolve which grid cells are "on" once — the font map never changes
    const bitmap: boolean[][] = Array.from({ length: rows }, () =>
      new Array(cols).fill(false)
    );
    let cx = 0;
    for (const ch of chars) {
      const glyph = FONT[ch] ?? FONT[" "];
      for (let r = 0; r < GLYPH_H; r++) {
        for (let c = 0; c < GLYPH_W; c++) {
          if (glyph[r][c] === "1") bitmap[r][cx + c] = true;
        }
      }
      cx += GLYPH_W + GLYPH_GAP;
    }

    let fg = getComputedStyle(canvas).color;
    let cellSize = 16;
    let dpr = 1;
    const cursor = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, amt: 0, tAmt: 0 };
    let raf = 0;

    const resize = () => {
      const width = wrap.clientWidth;
      cellSize = width / cols;
      const height = cellSize * rows;
      wrap.style.height = `${height}px`;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${cellSize * 0.92}px "GeistMono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      draw();
    };

    const draw = () => {
      const width = wrap.clientWidth;
      const height = cellSize * rows;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = fg;
      const r2 = cursorRadius * cursorRadius;
      const active = cursor.amt > 0.01;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!bitmap[r][c]) continue;
          const px = c * cellSize + cellSize / 2;
          const py = r * cellSize + cellSize / 2;
          // resting density — uniform, deliberately legible on its own
          let lum = 0.78;
          if (active) {
            const dx = px - cursor.x;
            const dy = py - cursor.y;
            const d2 = dx * dx + dy * dy;
            const dist = Math.sqrt(d2);
            const boost = Math.exp(-d2 / r2) * 0.22;
            const farStart = cursorRadius * 1.15;
            const far = Math.min(
              1,
              Math.max(0, (dist - farStart) / (cursorRadius * 3))
            );
            lum = lum + cursor.amt * (boost - far * 0.55);
          }
          lum = Math.min(1, Math.max(0.08, lum));
          const idx = Math.round(lum * (ASCII_RAMP.length - 1));
          const glyph = ASCII_RAMP[idx];
          if (glyph === " ") continue;
          ctx.globalAlpha = 0.35 + lum * 0.65;
          ctx.fillText(glyph, px, py);
        }
      }
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
      resizeTimer = setTimeout(resize, 100);
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
    // the site's theme toggle flips a `.dark` class on <html> live, with no
    // remount — watch it so the glyph color updates without a page reload
    const themeObserver = new MutationObserver(() => {
      fg = getComputedStyle(canvas).color;
      if (reduced) draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    resize();
    window.addEventListener("resize", onResize);
    canvas.addEventListener("pointermove", onPointer);
    canvas.addEventListener("pointerleave", onLeave);

    if (!reduced) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerleave", onLeave);
      themeObserver.disconnect();
    };
  }, [text, cursorRadius]);

  return (
    <div ref={wrapRef} className={`relative w-full ${className}`}>
      <canvas ref={canvasRef} aria-hidden className="ns-haw-canvas block w-full text-foreground" />
      <span className="sr-only">{text}</span>
    </div>
  );
}
