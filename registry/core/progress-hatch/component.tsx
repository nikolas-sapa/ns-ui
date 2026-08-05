"use client";

// A progress meter in the engineering-drawing register: the track is a run
// of a single light hatch glyph (░), the filled portion is solid (█), and
// the boundary between them is not a hard cut — a few columns of ordered
// dither (a 1D analogue of the Bayer matrix used elsewhere in this suite)
// blend ░▒▓█ across the leading edge so the fill reads as a texture gradient
// rather than a flat block edge. The numeric readout is not a separate
// element floating over the bar: it is printed into the same character grid,
// right-aligned, overwriting whichever hatch/fill glyphs would otherwise sit
// in those cells. Tick marks and labels sit on a second and third monospace
// line below, drawn as a box-drawing ruler (├──┬──┬──┬──┤).
//
// `value` glides toward its target over ~420ms via a single direct-DOM rAF
// loop that writes the built row string straight to a ref's textContent —
// never per-frame React state — and sleeps once the ease settles.

import { useEffect, useRef } from "react";

const RAMP = ["░", "▒", "▓", "█"] as const;
// 1D ordered-dither sequence (a Bayer-matrix analogue in one dimension):
// comparing a column's local edge position against its own threshold here,
// rather than a smooth density ramp, gives the edge visible grain instead of
// a clean gradient.
const DITHER = [0.15, 0.65, 0.35, 0.85, 0.5, 0.05, 0.95, 0.45];
const EDGE_COLS = 4; // width, in characters, of the dithered leading edge
const GLIDE_MS = 420;

function easeOutCubic(p: number): number {
  return 1 - (1 - p) ** 3;
}

function glyphAt(col: number, fillCols: number): string {
  const coverage = fillCols - col; // how far this column sits behind the fill edge
  if (coverage >= EDGE_COLS) return RAMP[3]; // "█", solidly filled
  if (coverage <= 0) return "░"; // untouched track
  const local = coverage / EDGE_COLS; // 0..1 through the dithered edge
  const threshold = DITHER[col % DITHER.length];
  const level = local > threshold ? Math.floor(local * 4) + 1 : Math.floor(local * 4);
  return RAMP[Math.max(0, Math.min(3, level))];
}

function buildBarRow(displayValue: number, totalChars: number, readoutWidth: number): string {
  const fillCols = (Math.max(0, Math.min(100, displayValue)) / 100) * totalChars;
  const chars: string[] = [];
  for (let col = 0; col < totalChars; col++) chars.push(glyphAt(col, fillCols));
  const numText = `${String(Math.round(displayValue)).padStart(readoutWidth - 1, " ")}%`;
  for (let i = 0; i < numText.length; i++) {
    chars[totalChars - numText.length + i] = numText[i];
  }
  return chars.join("");
}

function buildTicks(totalChars: number, marks: number[]): { tickLine: string; labelLine: string } {
  const tick = new Array(totalChars).fill("─");
  const label = new Array(totalChars).fill(" ");
  const cols = marks.map((m) => Math.round((Math.max(0, Math.min(100, m)) / 100) * (totalChars - 1)));
  cols.forEach((col, i) => {
    tick[col] = "┬";
    const text = String(marks[i]);
    let start = col - Math.floor((text.length - 1) / 2);
    start = Math.max(0, Math.min(totalChars - text.length, start));
    for (let k = 0; k < text.length; k++) label[start + k] = text[k];
  });
  tick[0] = "├";
  tick[totalChars - 1] = "┤";
  return { tickLine: tick.join(""), labelLine: label.join("") };
}

export interface HatchFillProps {
  /** progress, 0-100 (controlled). */
  value: number;
  /** bar width in characters. */
  totalChars?: number;
  /** percentages to tick and label below the bar. */
  marks?: number[];
  /** accessible label for the meter. */
  "aria-label"?: string;
  className?: string;
}

export function HatchFill({
  value,
  totalChars = 44,
  marks = [0, 25, 50, 75, 100],
  "aria-label": ariaLabel = "Progress",
  className = "",
}: HatchFillProps) {
  const rowRef = useRef<HTMLSpanElement>(null);
  const valueRef = useRef(value);
  const displayRef = useRef(value);
  const fromRef = useRef(value);
  const startRef = useRef(-1);
  const rafRef = useRef(0);
  const readoutWidth = 4; // " 37%" / "100%" — fixed width so digits never jitter the grid

  const { tickLine, labelLine } = buildTicks(totalChars, marks);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const paint = () => {
      row.textContent = buildBarRow(displayRef.current, totalChars, readoutWidth);
    };

    const loop = (now: number) => {
      const p = Math.min(1, (now - startRef.current) / GLIDE_MS);
      displayRef.current = fromRef.current + (valueRef.current - fromRef.current) * easeOutCubic(p);
      paint();
      if (p < 1) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = 0;
      }
    };

    if (reduced) {
      displayRef.current = value;
      paint();
    } else if (value !== displayRef.current) {
      fromRef.current = displayRef.current;
      startRef.current = performance.now();
      if (!rafRef.current) rafRef.current = requestAnimationFrame(loop);
    }
    valueRef.current = value;

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // clear the id, not just the frame: the restart guard below tests
      // `!rafRef.current`, so leaving a stale id here permanently wedges the
      // glide the first time a new value arrives mid-animation.
      rafRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rAF reads valueRef/displayRef live
  }, [value, totalChars]);

  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      className={`inline-block font-mono leading-[1.5] text-foreground ${className}`}
      style={{ width: `${totalChars}ch` }}
    >
      <span
        ref={rowRef}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        aria-label={ariaLabel}
        className="block whitespace-pre text-foreground"
      >
        {buildBarRow(value, totalChars, readoutWidth)}
      </span>
      <span aria-hidden className="block whitespace-pre text-border">
        {tickLine}
      </span>
      <span aria-hidden className="block whitespace-pre text-[0.85em] text-ns-muted">
        {labelLine}
      </span>
    </div>
  );
}
