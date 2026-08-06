"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// StatTileAsciiArrive — a KPI number that arrives as ink condensing into a
// glyph, not as a digit sliding into place (that job belongs to
// counter-carry-ripple). Each character of the formatted value is rendered
// on a fixed 5x7 dot-matrix bitmap (the same convention as a classic LED
// segment display, defined once as a lookup table). On mount, and again on
// every value change, every "on" cell of the target bitmap starts from a
// RANDOM step of a density ramp and every "off" cell starts near the ramp's
// empty end; each cell then eases independently (its own random start delay
// + duration jitter) toward its true target step, so the numeral visibly
// CONDENSES out of noise instead of just fading or sliding in. Once every
// cell has reached its target the canvas stops redrawing entirely — this is
// a display-only component, so there is no reason to keep painting an
// identical frame forever.
//
// Pure <canvas>, cell coloring read via getComputedStyle so both themes are
// correct without a single hardcoded hex. prefers-reduced-motion renders the
// settled glyph immediately, no condensation pass.
// ---------------------------------------------------------------------------

const RAMP = " .:-=+*#%@"; // 10-step density ramp, index 0 = empty
const CELL_W = 5;
const CELL_H = 7;
const SETTLE_MS = 620; // worst-case per-cell settle time
const MAX_STAGGER_MS = 220; // spread of per-cell start delay

// 5x7 dot-matrix glyphs, 1 = ink. Minimal set: digits, separators, sign.
const GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ",": ["00000", "00000", "00000", "00000", "00000", "00100", "01000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "%": ["11001", "11010", "00100", "01000", "10011", "10011", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function glyphRows(ch: string): string[] {
  return GLYPHS[ch] ?? GLYPHS[" "]!;
}

interface CellAnim {
  target: number; // 0 or 1 (ink or not)
  from: number; // starting ramp index
  delay: number; // ms
  dur: number; // ms
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export interface StatTileAsciiArriveProps {
  /** formatted or raw value; numbers get toLocaleString, strings pass through */
  value: number | string;
  /** caption above the readout */
  label?: string;
  /** shown after the value, e.g. "%" or "ms" */
  suffix?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function StatTileAsciiArrive({
  value,
  label,
  suffix = "",
  className = "",
}: StatTileAsciiArriveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const seedRef = useRef(0);

  const formatted =
    typeof value === "number" ? value.toLocaleString() : value;
  const text = `${formatted}${suffix}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    seedRef.current += 1;
    const rand = mulberry32(0x9e3779b1 + seedRef.current * 101);

    let fgCss = "currentColor";
    let disposed = false;
    let raf = 0;
    let start = 0;

    const readTokens = () => {
      fgCss = getComputedStyle(canvas).color;
    };
    const fontFamily = getComputedStyle(canvas).fontFamily;

    const chars = text.split("");
    const glyphW = CELL_W;
    const gapCols = 1; // gap between characters, in dot columns
    const totalCols = chars.reduce((sum, c, i) => sum + glyphW + (i > 0 ? gapCols : 0), 0);
    const MAX_DOT_PX = 5; // px per dot cell at full size (before dpr scaling)
    const MAX_DOT_GAP = 1.4;
    const MIN_DOT_PX = 2.4; // never shrink glyphs illegibly small

    // scale the whole dot-matrix down to fit whatever width the card
    // actually has available — a long value (e.g. "48,200") in a narrow
    // tile must never overflow its card, and a stat tile's value length is
    // arbitrary, so this can't be a fixed constant
    const available = canvas.parentElement?.getBoundingClientRect().width || 0;
    const idealPitch = MAX_DOT_PX + MAX_DOT_GAP;
    const neededW = (totalCols + 1) * idealPitch;
    const scale = available > 0 ? Math.min(1, available / neededW) : 1;
    const dotPx = Math.max(MIN_DOT_PX, MAX_DOT_PX * scale);
    const dotGap = MAX_DOT_GAP * scale;
    const pitch = dotPx + dotGap;

    let dpr = 1;
    const resize = () => {
      const w = totalCols * pitch + pitch;
      const h = CELL_H * pitch + pitch * 2;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${dotPx * 1.7}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
    };
    resize();

    // build the per-cell animation plan across the whole string
    const cols = totalCols;
    const rows = CELL_H;
    const cells: CellAnim[] = new Array(cols * rows);
    let colCursor = 0;
    chars.forEach((ch, ci) => {
      const rowsFor = glyphRows(ch);
      for (let r = 0; r < rows; r++) {
        const bits = rowsFor[r]!;
        for (let c = 0; c < glyphW; c++) {
          const target = bits[c] === "1" ? 1 : 0;
          const idx = r * cols + (colCursor + c);
          cells[idx] = {
            target,
            from: target === 1 ? Math.floor(rand() * (RAMP.length - 2)) : RAMP.length - 1 - Math.floor(rand() * 2),
            delay: rand() * MAX_STAGGER_MS,
            dur: SETTLE_MS * (0.75 + rand() * 0.35),
          };
        }
      }
      colCursor += glyphW + (ci < chars.length - 1 ? gapCols : 0);
    });

    const cellX = (c: number) => pitch / 2 + c * pitch + dotPx / 2;
    const cellY = (r: number) => pitch + r * pitch + dotPx / 2;

    const drawStatic = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = fgCss;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = cells[r * cols + c];
          if (!cell || cell.target === 0) continue;
          ctx.globalAlpha = 1;
          ctx.fillText(RAMP[RAMP.length - 1]!, cellX(c), cellY(r));
        }
      }
      ctx.globalAlpha = 1;
    };

    // draws the character at ramp index `step` (rounded) with alpha keyed to
    // how far into its ink range that index sits, so the transition between
    // adjacent glyphs still reads as a continuous density ramp rather than
    // a visible per-frame glyph pop
    const drawFrame = (elapsed: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = fgCss;
      let allDone = true;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = cells[r * cols + c];
          if (!cell) continue;
          const local = elapsed - cell.delay;
          let step: number;
          if (local <= 0) {
            step = cell.from;
            allDone = false;
          } else if (local >= cell.dur) {
            step = cell.target === 1 ? RAMP.length - 1 : 0;
          } else {
            const t = easeOutCubic(local / cell.dur);
            step = cell.from + (cell.target === 1 ? RAMP.length - 1 - cell.from : 0 - cell.from) * t;
            allDone = false;
          }
          const idx = Math.max(0, Math.min(RAMP.length - 1, Math.round(step)));
          if (idx === 0) continue;
          ctx.globalAlpha = 0.4 + (idx / (RAMP.length - 1)) * 0.6;
          ctx.fillText(RAMP[idx]!, cellX(c), cellY(r));
        }
      }
      ctx.globalAlpha = 1;
      return allDone;
    };

    readTokens();

    if (reduced) {
      drawStatic();
    } else {
      const loop = (now: number) => {
        if (disposed) return;
        if (!start) start = now;
        const elapsed = now - start;
        const done = drawFrame(elapsed);
        if (!done) {
          raf = requestAnimationFrame(loop);
        }
      };
      raf = requestAnimationFrame(loop);
    }

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) drawStatic();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      mo.disconnect();
    };
    // re-run the whole condensation whenever the displayed text changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className={`flex w-full min-w-0 flex-col items-start gap-2 ${className}`}>
      {label && (
        <span className="font-mono text-[10px] uppercase tracking-widest text-ns-muted">{label}</span>
      )}
      <canvas ref={canvasRef} aria-hidden data-stat-canvas className="block font-mono" />
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {label ? `${label}: ${text}` : text}
      </span>
    </div>
  );
}
