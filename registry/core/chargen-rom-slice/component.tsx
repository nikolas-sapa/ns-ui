"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// ChargenRomSlice — a status glyph that reconstructs the way 1970s-80s CRT
// text-mode video controllers actually drew characters: a character-generator
// ROM stores each glyph as an 8-row bitmap, but the controller never fetches
// a whole glyph in one go. It reads the ROM one scanline row at a time, in
// step with the beam, shifts that row of bits out across the row, then drops
// to the next row and re-addresses the ROM for the next slice. A glyph is
// only ever "whole" for an instant, once per frame — every other instant it
// is a stack of independently-fetched horizontal slices with a hard gap
// below the last one fetched.
//
// Each on-screen character gets its own 35ms-per-row sweep (row N becomes
// visible at N*35ms into that character's build), 8 rows -> 280ms per glyph.
// Characters start staggered 60ms apart left-to-right, so a 6-character
// string is fully clean ~580ms after the cycle starts. It then holds fully
// assembled for 500ms before every row resets to 0 and the sweep restarts —
// a single fixed 1080ms cycle, run on real elapsed time (not frame count) so
// speed never depends on paint rate.
// ---------------------------------------------------------------------------

// Built-in 5x7 block font (uppercase A-Z, 0-9, space, punctuation used by the
// default string) with a blank 8th row appended — real chargen ROMs commonly
// address an 8- or 9-row cell for a 7-row glyph, leaving a descender row
// blank. Hand-drawn geometric shapes, not a traced copy of a real ROM dump.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001", "00000"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110", "00000"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111", "00000"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110", "00000"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111", "00000"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000", "00000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01110", "00000"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001", "00000"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110", "00000"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100", "00000"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001", "00000"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111", "00000"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001", "00000"],
  N: ["10001", "11001", "10101", "10101", "10011", "10001", "10001", "00000"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110", "00000"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000", "00000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101", "00000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001", "00000"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110", "00000"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100", "00000"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110", "00000"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100", "00000"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001", "00000"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001", "00000"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100", "00000"],
  Z: ["11111", "00010", "00100", "01000", "10000", "10000", "11111", "00000"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110", "00000"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110", "00000"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111", "00000"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110", "00000"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010", "00000"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110", "00000"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110", "00000"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000", "00000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110", "00000"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100", "00000"],
  "_": ["00000", "00000", "00000", "00000", "00000", "00000", "11111", "00000"],
};

const GLYPH_W = 5;
const GLYPH_H = 8;
const GLYPH_GAP = 1; // blank columns between characters
const ROW_MS = 35; // one ROM scanline slice revealed every 35ms (~28 rows/s)
const CHAR_STAGGER_MS = 60; // each character's sweep starts 60ms after the previous
const HOLD_MS = 500; // full-string clean hold before the sweep resets to row 0

// Frozen prefers-reduced-motion frame: the live sweep's row-reveal math
// evaluated at a fixed 300ms cycle position — an early character fully
// assembled, the next mid-sweep with a visible hard-edged slice seam, later
// ones still thin or untouched. A named cycle position (not a hardcoded
// per-index array) so it stays a genuine sweep frame for any string length.
const FREEZE_MS = 300;

// Live sweep at t0 is seeded this far into its own cycle rather than at 0 so
// the very first paint is already mid-sweep (per the resting-loop spec: t0
// shows glyphs with only their top rows revealed, not a blank canvas). 170
// is chosen so the cycle-phase-locked t0/2.5s/5s samples (1080ms cycle, 2.5s
// and 5s land 340ms/680ms further into the cycle) land in three distinct
// states — mid-sweep, a later mid-sweep, and the clean hold — rather than
// two of the three sample points both landing inside the 500ms hold.
const T0_PHASE_MS = 170;

export interface ChargenRomSliceProps {
  /** status string; unsupported characters render as a blank cell */
  text?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function ChargenRomSlice({
  text = "BUFFER",
  className = "",
}: ChargenRomSliceProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const chars = Array.from(text.toUpperCase()).slice(0, 12);
    const cols = chars.length * GLYPH_W + Math.max(0, chars.length - 1) * GLYPH_GAP;
    const rows = GLYPH_H;
    const glyphMs = GLYPH_H * ROW_MS; // 280ms — one full glyph sweep
    const buildMs = (chars.length - 1) * CHAR_STAGGER_MS + glyphMs; // full-string assembly
    const cycleMs = buildMs + HOLD_MS;

    // resolve which grid cells are "on" once — the font map never changes
    const bitmap: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
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
    let cellPx = 12;
    let dpr = 1;
    let raf = 0;
    let cycleStart = 0;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    // rows currently revealed for each character, 0..GLYPH_H
    const revealed = new Array(chars.length).fill(0);

    const computeRevealed = (cyclePos: number) => {
      if (cyclePos >= buildMs) {
        revealed.fill(GLYPH_H);
        return;
      }
      for (let i = 0; i < chars.length; i++) {
        const elapsed = cyclePos - i * CHAR_STAGGER_MS;
        revealed[i] = elapsed <= 0 ? 0 : Math.min(GLYPH_H, Math.floor(elapsed / ROW_MS));
      }
    };

    const draw = () => {
      const width = cols * cellPx;
      const height = rows * cellPx;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = fg;
      let cxCol = 0;
      for (let i = 0; i < chars.length; i++) {
        const n = revealed[i];
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < GLYPH_W; c++) {
            if (!bitmap[r][cxCol + c]) continue;
            // full cellPx, no inter-row gap — the only horizontal
            // discontinuity in a glyph must be the sweep seam itself
            ctx.fillRect((cxCol + c) * cellPx, r * cellPx, cellPx, cellPx);
          }
        }
        cxCol += GLYPH_W + GLYPH_GAP;
      }
    };

    const resize = () => {
      const availW = wrap.clientWidth;
      const availH = wrap.clientHeight || availW;
      const minDim = Math.min(availW, availH);
      cellPx = Math.min(16, Math.max(8, Math.round(minDim / 20)));
      // the wrap can be smaller than what the geometry formula wants (e.g. a
      // narrow card) — never let the canvas overflow its own container
      cellPx = Math.max(1, Math.min(cellPx, Math.floor(availW / cols), Math.floor(availH / rows)));
      const width = cols * cellPx;
      const height = rows * cellPx;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const cyclePos = reduced ? FREEZE_MS : (performance.now() - cycleStart + cycleMs) % cycleMs;
      computeRevealed(cyclePos);
      draw();
    };

    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 100);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(wrap);

    // the site's theme toggle flips a `.dark` class on <html> live, with no
    // remount — watch it so the glyph colour updates without a page reload
    const themeObserver = new MutationObserver(() => {
      fg = getComputedStyle(canvas).color;
      draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    let visible = true;
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced && !raf) raf = requestAnimationFrame(loop);
    });
    io.observe(wrap);

    function loop() {
      if (!visible) {
        raf = 0;
        return;
      }
      const cyclePos = (performance.now() - cycleStart) % cycleMs;
      computeRevealed(cyclePos);
      draw();
      raf = requestAnimationFrame(loop);
    }

    // seed the cycle already mid-sweep so the very first paint (t0) shows
    // partially-built glyphs, not a blank canvas
    cycleStart = performance.now() - T0_PHASE_MS;
    resize();
    window.addEventListener("resize", onResize);

    if (!reduced) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
    };
  }, [text]);

  return (
    <div
      ref={wrapRef}
      className={`ns-crs-wrap flex h-full w-full items-center justify-center ${className}`}
    >
      <canvas ref={canvasRef} aria-hidden className="block text-foreground" />
      <span className="sr-only">{text}</span>
    </div>
  );
}
