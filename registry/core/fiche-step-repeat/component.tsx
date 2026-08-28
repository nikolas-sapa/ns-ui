"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// FicheStepRepeat — a thumbnail grid that populates the way a COM (computer
// output microfilm) step-and-repeat camera exposed a microfiche sheet: one
// frame at a time, strict raster order (left-to-right, then down a row), a
// short exposure flash on arrival, and a typed index strip once the sheet is
// complete. The mechanical step between frames is genuinely the slow part —
// the flash itself is brief — so growth is paced at one cell per STEP_MS,
// with an explicit FLASH_UP/FLASH_DOWN envelope on top of every arrival
// rather than a plain fade-in (the real process is a discrete exposure, not
// a dissolve).
//
// Grid geometry: cols/rows are derived from the container's own width and
// height divided by a ~64px target cell, clamped to a 4x3 minimum and a
// 7x5 maximum — the closest card-scale abstraction of a real fiche's
// row/column raster (full sheets run 7x14 or denser; this keeps a card
// legible). One rAF loop drives the whole cycle from a single elapsed-time
// clock (grow -> type -> hold -> reset), touching the DOM directly per
// cell rather than through React state, since redrawing 12-35 tiny cells
// through render on every animation frame would be wasted work.
// ---------------------------------------------------------------------------

const STEP_MS = 850; // one raster step: mechanical pitch between exposures
const FLASH_UP_MS = 120; // exposure flash ramp to peak
const FLASH_DOWN_MS = 280; // flash relaxes back to the cell's rest luminance
const FLASH_MS = FLASH_UP_MS + FLASH_DOWN_MS;
const TYPE_MS = 600; // index strip typing window
const TYPE_CHAR_MS = 17; // ~one character reveal every 17ms
const HOLD_MS = 1400; // full-sheet hold once the index strip finishes
const RESET_MS = 400; // raster-order step back to blank
const FLASH_AMP_DARK = 0.12; // +12% luminance over settled value (dark theme)
const FLASH_AMP_LIGHT = 0.08; // less headroom against near-white thumbnails
const TARGET_CELL_PX = 64;
const MIN_COLS = 4;
const MAX_COLS = 7;
const MIN_ROWS = 3;
const MAX_ROWS = 5;

export interface FicheFrame {
  /** thumbnail image URL for this raster position */
  src: string;
  /** accessible description of the frame */
  alt: string;
}

export interface FicheStepRepeatProps {
  /** real thumbnails placed in raster order; cells beyond the supplied count
   * render the built-in placeholder silhouette */
  images?: FicheFrame[];
  /** reduction ratio printed on the index strip, e.g. 24 for "24x" */
  reductionRatio?: number;
  /** extra classes merged onto the root element */
  className?: string;
}

function FrameSilhouette() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-2/5 w-2/5 text-ns-muted opacity-40"
    >
      <rect x="2" y="2" width="20" height="20" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M3 17.5l5-5a1.4 1.4 0 0 1 2 0l4.5 4.5 1.5-1.5a1.4 1.4 0 0 1 2 0L21 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FicheStepRepeat({ images = [], reductionRatio = 24, className = "" }: FicheStepRepeatProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerRef = useRef<HTMLParagraphElement>(null);
  const [grid, setGrid] = useState({ cols: MAX_COLS, rows: MAX_ROWS });
  const headerId = useId();

  const cellCount = grid.cols * grid.rows;
  const label = `${reductionRatio}× · ${cellCount} FRAMES`;

  // Derive the raster grid from the container's own dimensions — the
  // smaller axis governs how coarse a "still reads at card scale" grid is,
  // but each axis gets its own count so a wide card doesn't get squeezed
  // into a square.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const cols = Math.min(MAX_COLS, Math.max(MIN_COLS, Math.round(rect.width / TARGET_CELL_PX)));
      const rows = Math.min(MAX_ROWS, Math.max(MIN_ROWS, Math.round(rect.height / TARGET_CELL_PX)));
      setGrid((prev) => (prev.cols === cols && prev.rows === rows ? prev : { cols, rows }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const cells = cellRefs.current.slice(0, cellCount);
    const growEnd = cellCount * STEP_MS;
    const typeEnd = growEnd + TYPE_MS;
    const holdEnd = typeEnd + HOLD_MS;
    const totalCycle = holdEnd + RESET_MS;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Theme flip only ever swaps the `.dark` class — track it live so the
    // flash amplitude reads correctly without a remount.
    let flashAmp = document.documentElement.classList.contains("dark") ? FLASH_AMP_DARK : FLASH_AMP_LIGHT;
    const mo = new MutationObserver(() => {
      flashAmp = document.documentElement.classList.contains("dark") ? FLASH_AMP_DARK : FLASH_AMP_LIGHT;
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const populated = new Array(cellCount).fill(false);
    let lastFlashCell = -1;
    let lastTypedChars = -1;

    const setFilled = (i: number, filled: boolean) => {
      if (populated[i] === filled) return;
      populated[i] = filled;
      const el = cells[i];
      if (!el) return;
      if (filled) el.dataset.filled = "true";
      else delete el.dataset.filled;
    };

    const clearFlash = (i: number) => {
      const el = cells[i];
      if (el) el.style.removeProperty("filter");
    };

    const setHeaderText = (text: string) => {
      if (lastTypedChars === text.length && header.textContent === text) return;
      header.textContent = text;
      lastTypedChars = text.length;
    };

    // Reduced motion: freeze on the full-sheet hold frame — every cell
    // populated at rest, index strip fully typed, no flash, no loop.
    if (reduced) {
      for (let i = 0; i < cellCount; i++) setFilled(i, true);
      setHeaderText(label);
      return () => mo.disconnect();
    }

    let raf = 0;
    let cycleStart = 0;
    let visible = true;

    const tick = (now: number) => {
      if (!visible) return;
      if (cycleStart === 0) cycleStart = now;
      let elapsed = now - cycleStart;
      if (elapsed >= totalCycle) {
        cycleStart += totalCycle;
        elapsed -= totalCycle;
      }

      if (elapsed < growEnd) {
        const idx = Math.min(cellCount - 1, Math.floor(elapsed / STEP_MS));
        for (let i = 0; i <= idx; i++) setFilled(i, true);
        const localT = elapsed - idx * STEP_MS;
        if (localT < FLASH_MS) {
          const p = localT < FLASH_UP_MS ? localT / FLASH_UP_MS : 1 - (localT - FLASH_UP_MS) / FLASH_DOWN_MS;
          const b = 1 + p * flashAmp;
          const el = cells[idx];
          if (el) el.style.filter = `brightness(${b.toFixed(3)})`;
          lastFlashCell = idx;
        } else if (lastFlashCell === idx) {
          clearFlash(idx);
          lastFlashCell = -1;
        }
        if (lastTypedChars !== 0) setHeaderText("");
      } else if (elapsed < typeEnd) {
        if (lastFlashCell !== -1) {
          clearFlash(lastFlashCell);
          lastFlashCell = -1;
        }
        const typed = Math.min(label.length, Math.floor(((elapsed - growEnd) / TYPE_MS) * label.length));
        setHeaderText(label.slice(0, typed));
      } else if (elapsed < holdEnd) {
        setHeaderText(label);
      } else {
        if (lastTypedChars !== 0) setHeaderText("");
        const t = elapsed - holdEnd;
        const removed = Math.min(cellCount, Math.floor((t / RESET_MS) * cellCount));
        for (let i = 0; i < removed; i++) setFilled(i, false);
      }

      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver((entries) => {
      const wasVisible = visible;
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !wasVisible) {
        // resume without a discontinuity: nudge cycleStart so elapsed picks
        // up exactly where it left off, then re-arm the loop.
        cycleStart = 0;
        if (!raf) raf = requestAnimationFrame((now) => {
          cycleStart = now;
          raf = requestAnimationFrame(tick);
        });
      }
    });
    io.observe(rootRef.current ?? header);

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellCount, label]);

  return (
    <div
      ref={rootRef}
      role="list"
      aria-labelledby={headerId}
      className={`relative flex h-full w-full flex-col gap-2 ${className}`}
    >
      <p id={headerId} className="sr-only">
        Thumbnail sheet, {label}
      </p>
      <p
        ref={headerRef}
        aria-hidden="true"
        className="h-3.5 shrink-0 whitespace-nowrap font-mono text-[11px] tracking-widest text-ns-muted"
      />
      <div
        className="grid min-h-0 flex-1 gap-1.5"
        style={{ gridTemplateColumns: `repeat(${grid.cols}, 1fr)`, gridTemplateRows: `repeat(${grid.rows}, 1fr)` }}
      >
        {Array.from({ length: cellCount }, (_, i) => {
          const frame = images[i];
          return (
            <div
              key={i}
              role="listitem"
              className="relative overflow-hidden rounded-[1px] border border-border"
            >
              <div
                ref={(el) => {
                  cellRefs.current[i] = el;
                }}
                className="absolute inset-0 flex items-center justify-center bg-surface opacity-0 outline-none transition-opacity duration-0 data-[filled=true]:opacity-100"
                style={{ willChange: "filter" }}
              >
                {frame ? (
                  <img
                    src={frame.src}
                    alt={frame.alt}
                    className="h-full w-full object-cover transition-[filter] duration-150 hover:brightness-105 focus-visible:brightness-105"
                    draggable={false}
                  />
                ) : (
                  <FrameSilhouette />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
