"use client";

// ShutterTelegraphBoard — an ambient multi-stage status board modelled on the
// Admiralty six-shutter telegraph (Murray's telegraph, England 1795-1816): a
// 2x3 board of louvred shutters, each independently flipped edge-on (nearly
// invisible, background shows through) or face-on (a solid opaque square),
// read hilltop to hilltop through a telescope. Each of the 63 open/closed
// combinations encoded a number or codebook phrase.
//
// Pure DOM/CSS, no canvas. Each shutter is a small stack of two divs: a
// fixed 1px --foreground-at-25%-opacity frame (the shutter's edge, visible
// once the panel in front of it rotates out of the way) and an opaque
// --foreground panel driven purely by `transform: perspective(...)
// rotateY(deg)` between 0deg (face-on/closed) and 90deg (edge-on/open) — the
// perspective projection itself is what visually collapses the panel to a
// near-invisible sliver, no opacity fade involved. Every 2s a new symbol
// (one of 8 fixed 6-bit patterns) is applied; the six shutters that need to
// flip each get a 60ms-staggered transitionDelay in reading order
// (left-to-right, top-to-bottom) so a symbol change reads as a wave
// crossing the board rather than a simultaneous snap, each individual flip
// taking 320ms ease-in-out. Colours are plain `var(--foreground)` in inline
// styles — pure DOM with no per-pixel colour math, so (as with the shipped
// flag-hoist-run) there is nothing for getComputedStyle/MutationObserver to
// do that the CSS cascade doesn't already do for free on a theme switch.

import { useEffect, useRef, useState } from "react";

const COLS = 2;
const ROWS = 3;
const CELL_COUNT = COLS * ROWS;

const FLIP_MS = 320;
const STAGGER_MS = 60;
const DWELL_MS = 1700;
const SYMBOL_INTERVAL_MS = DWELL_MS + (CELL_COUNT - 1) * STAGGER_MS; // ~2000ms
const PERSPECTIVE_PX = 600;

// 8 fixed 6-bit symbols, reading order (row-major, top-to-bottom,
// left-to-right within a row): true = open (edge-on), false = closed
// (face-on). Index 4 is an exact checkerboard — 3 open / 3 closed, the
// maximum structural contrast in the set — reserved as the reduced-motion
// freeze frame. The set deliberately also contains the degenerate
// all-closed (0) and all-open (5) symbols elsewhere in the loop, which is
// exactly why those two are never chosen as the static frame.
const SYMBOLS: readonly boolean[][] = [
  [false, false, false, false, false, false],
  [true, true, false, false, true, false],
  [false, true, true, false, true, true],
  [true, false, true, true, false, false],
  [true, false, false, true, true, false], // checkerboard — reduced-motion frame
  [true, true, true, true, true, true],
  [false, true, false, true, false, true],
  [true, false, true, false, true, false],
];

const STATIC_SYMBOL_INDEX = 4;
const START_SYMBOL_INDEX = 2; // a mixed, non-degenerate t0

export interface ShutterTelegraphBoardProps {
  /** accessible label for the ambient board */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function ShutterTelegraphBoard({
  label = "Signal board",
  className = "",
}: ShutterTelegraphBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(0);
  const [reduced, setReduced] = useState(false);
  // matches SSR's default (reduced motion is unknown server-side); flipped
  // to STATIC_SYMBOL_INDEX synchronously in the reduced-motion effect below
  // before any timer would otherwise fire, so no flash of the wrong symbol.
  const [symbolIndex, setSymbolIndex] = useState(START_SYMBOL_INDEX);

  // -- reduced motion: pin to the checkerboard symbol, never advance. ----
  useEffect(() => {
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(isReduced);
    if (isReduced) setSymbolIndex(STATIC_SYMBOL_INDEX);
  }, []);

  // -- geometry: square shutters sized from the container's smaller
  // dimension, so the board reads at card scale on any card. -------------
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const minDim = Math.min(rect.width, rect.height);
      setCellSize(minDim / 4);
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  // -- the loop: a new symbol every SYMBOL_INTERVAL_MS, unbounded, 8-symbol
  // repeat (~16s per full cycle). Paused while off-screen, skipped
  // entirely under reduced motion. ----------------------------------------
  useEffect(() => {
    if (reduced) return;
    const root = rootRef.current;
    if (!root) return;
    let id = 0;
    const start = () => {
      if (id) return;
      id = window.setInterval(() => {
        setSymbolIndex((i) => (i + 1) % SYMBOLS.length);
      }, SYMBOL_INTERVAL_MS);
    };
    const stop = () => {
      if (!id) return;
      window.clearInterval(id);
      id = 0;
    };
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) start();
      else stop();
    });
    io.observe(root);
    return () => {
      stop();
      io.disconnect();
    };
  }, [reduced]);

  const gap = cellSize * 0.14;
  const pattern = SYMBOLS[symbolIndex] ?? SYMBOLS[0]!;

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={label}
      className={`relative flex w-full items-center justify-center overflow-hidden ${className}`}
    >
      <div
        ref={gridRef}
        aria-hidden="true"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${cellSize}px)`,
          gap: `${gap}px`,
          visibility: cellSize > 0 ? "visible" : "hidden",
        }}
      >
        {pattern.map((open, i) => (
          <div key={i} style={{ position: "relative", width: cellSize, height: cellSize }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                border: "1px solid var(--foreground)",
                opacity: 0.25,
              }}
            />
            <div
              className="ns-shutter-panel"
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "var(--foreground)",
                transformOrigin: "50% 50%",
                transform: `perspective(${PERSPECTIVE_PX}px) rotateY(${open ? 90 : 0}deg)`,
                transitionProperty: reduced ? "none" : "transform",
                transitionDuration: `${FLIP_MS}ms`,
                transitionTimingFunction: "ease-in-out",
                transitionDelay: `${i * STAGGER_MS}ms`,
              }}
            />
          </div>
        ))}
      </div>
      <style>{`
@media (prefers-reduced-motion: reduce){
  .ns-shutter-panel{transition:none!important;}
}
`}</style>
    </div>
  );
}
