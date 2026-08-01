"use client";

// A loader built from braille cells (U+2800 block), where each cell's eight
// dots are individually addressable bits rather than a single glyph from a
// spinner sprite sheet. Indeterminate: a wave travels through the row — each
// cell's fill level is a sine function of time, phase-shifted by its column,
// so dots rise and fall like a stadium wave rather than a rotating glyph.
// Determinate: `progress` maps onto every dot across the row in reading
// order (cell 0's eight dots fill first, then cell 1's, ...), so 0-100% has
// N_CELLS * 8 addressable steps — far finer than a block-character bar could
// offer at the same character width. Reaching 100 triggers a one-shot accent
// pulse across the row before settling.
//
// One direct-DOM rAF loop builds the row string and writes it to a single
// ref's textContent each frame (never React state per frame); glyph color is
// read from getComputedStyle so it tracks the surrounding theme. Settling
// on completion is the only thing that goes through React state, since it's
// a discrete one-shot transition, not a per-frame value.

import { useEffect, useId, useRef, useState } from "react";

const N_CELLS = 14;
// dot fill priority within a cell, bottom row first: rises like a level meter
const PRIORITY = [7, 8, 3, 6, 2, 5, 1, 4] as const;
const BIT: Record<number, number> = { 1: 0x01, 2: 0x02, 3: 0x04, 4: 0x08, 5: 0x10, 6: 0x20, 7: 0x40, 8: 0x80 };

function cellChar(n: number): string {
  const count = Math.max(0, Math.min(8, Math.round(n)));
  let mask = 0;
  for (let i = 0; i < count; i++) mask |= BIT[PRIORITY[i]];
  return String.fromCharCode(0x2800 + mask);
}

const WAVE_SPEED = 2.6; // rad/s
const PHASE_STEP = 0.55; // rad per column
const SETTLE_MS = 480;

export interface BrailleSpinProps {
  /** 0-100 for a determinate fill; omit (or leave undefined) for the indeterminate wave. */
  progress?: number;
  /** accessible label for the progressbar. */
  "aria-label"?: string;
  className?: string;
}

export function BrailleSpin({
  progress,
  "aria-label": ariaLabel = "Loading",
  className = "",
}: BrailleSpinProps) {
  const rowRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef(progress);
  const [settled, setSettled] = useState(progress != null && progress >= 100);
  const settledOnceRef = useRef(settled);
  const idBase = useId();

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (progress != null && progress >= 100) {
      if (!settledOnceRef.current) {
        settledOnceRef.current = true;
        setSettled(true);
        const t = window.setTimeout(() => setSettled(false), SETTLE_MS);
        return () => window.clearTimeout(t);
      }
    } else {
      settledOnceRef.current = false;
    }
  }, [progress]);

  // mount-once animated loop; skipped entirely under reduced motion
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const paint = (levels: number[]) => {
      row.textContent = levels.map(cellChar).join("");
    };
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const p = progressRef.current;
      if (p == null) {
        const t = (now - start) / 1000;
        paint(
          Array.from({ length: N_CELLS }, (_, i) => 4 + 4 * Math.sin(t * WAVE_SPEED - i * PHASE_STEP))
        );
      } else {
        const totalDots = N_CELLS * 8;
        const litDots = Math.round((Math.max(0, Math.min(100, p)) / 100) * totalDots);
        paint(Array.from({ length: N_CELLS }, (_, i) => litDots - i * 8));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // reduced motion: one correct static frame, repainted live if `progress` changes
  // (there is no running loop above to pick that change up on its own)
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (progress == null) {
      // gentle standing arc stands in for the wave with nothing moving
      row.textContent = Array.from({ length: N_CELLS }, (_, i) => cellChar(4 + 2 * Math.sin(i * PHASE_STEP))).join("");
    } else {
      const totalDots = N_CELLS * 8;
      const litDots = Math.round((Math.max(0, Math.min(100, progress)) / 100) * totalDots);
      row.textContent = Array.from({ length: N_CELLS }, (_, i) => cellChar(litDots - i * 8)).join("");
    }
  }, [progress]);

  const determinate = progress != null;
  const clamped = determinate ? Math.max(0, Math.min(100, progress as number)) : undefined;

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={determinate ? Math.round(clamped as number) : undefined}
      className={`inline-block font-mono leading-none ${className}`}
    >
      <style>{`
.ns-braille-row{transition:color 260ms ease-out}
.ns-braille-settled{color:var(--accent) !important}
`}</style>
      <span
        ref={rowRef}
        id={idBase}
        aria-hidden
        className={`ns-braille-row whitespace-pre text-foreground ${settled ? "ns-braille-settled" : ""}`}
      >
        {cellChar(0).repeat(N_CELLS)}
      </span>
    </div>
  );
}
