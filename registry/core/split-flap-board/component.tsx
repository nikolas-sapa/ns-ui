"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SolariFlap — a mechanical split-flap (Solari board) display for short
// status strings. Each character cell is FOUR stacked layers, not a single
// rolling digit (that's carry-digit's territory):
//   - a static bottom plate (permanently shows the settled char's bottom
//     half, updated mid-flip)
//   - a static "under" plate behind the flap (only ever exposed by the
//     hover-peek lift; holds a plausible upcoming glyph)
//   - the flap itself: one absolutely-positioned div with two opposite
//     faces (front = outgoing glyph's top half, back = incoming glyph's
//     top half, pre-rotated 180deg) that rotates -180deg on a real 3D
//     hinge (transform-origin: bottom). Because the back face is baked
//     to rotateX(180deg), driving the parent from 0 to -180 makes the
//     back face the one facing the camera in the second half of the
//     swing — the classic double-sided flip-card trick, done with a
//     single element instead of two.
// A value change schedules each cell through a short chain of quick
// flips (3-6 steps through random charset glyphs, landing on the target
// on the last one) so it reads as clattering machinery, not a lookup.
// Per-cell start times are staggered by a random 20-40ms offset times the
// cell's index, so the ripple visibly travels left-to-right. All of this
// is direct DOM writes on refs (style.transform/transition set
// imperatively, no React state on the per-flip hot path) — only the
// settled `displayed` char lives on a plain object, not state.
//
// Hover (mouse only, this is a status display, not a control): entering
// the board pauses further step-scheduling for every cell (in-flight
// steps still finish, but no new ones start) until the pointer leaves;
// entering one cell additionally lifts that cell's flap 22deg on its
// hinge, exposing the static "under" plate behind it as a peek at an
// upcoming glyph. Cells are real <button> elements (so a plain pointer
// hover is genuinely detectable and the lift is a real, testable state
// change) but are aria-hidden and not tab-reachable: the graphic is
// decorative, the accessible surface is a single aria-live=polite
// status region that announces only the fully-settled final string
// (never the intermediate cycling glyphs), so a screen reader hears one
// clean update per value change instead of a burst of static.
//
// prefers-reduced-motion: every cell jumps straight to its target glyph,
// no cycling, no flap rotation — the split line and two-plate structure
// stay, so it still reads as a (static) flap board, just not animating.
// ---------------------------------------------------------------------------

export interface SolariFlapProps {
  /** The string to display. One cell is rendered per character. */
  value: string;
  /** Glyphs cycled through mid-flip and used for the hover-peek plate. */
  charset?: string;
  /** Cell width in px. Default 34. */
  cellWidth?: number;
  /** Cell height in px. Default 50. */
  cellHeight?: number;
  className?: string;
}

const DEFAULT_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .:-";
const FLIP_MS = 150;
const HOLD_MS = 45;
const MIN_STEPS = 3;
const MAX_STEPS = 6;
const STAGGER_MIN_MS = 20;
const STAGGER_MAX_MS = 40;
const HOVER_LIFT_DEG = 22;
const HOVER_MS = 160;
const FLIP_EASE = "cubic-bezier(0.61, 0, 0.4, 1)";
const HOVER_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

interface CellHandle {
  leaf: HTMLDivElement | null;
  front: HTMLSpanElement | null;
  back: HTMLSpanElement | null;
  bottom: HTMLSpanElement | null;
  under: HTMLSpanElement | null;
  displayed: string;
  hovering: boolean;
  token: number;
}

function pick(charset: string): string {
  return charset[Math.floor(Math.random() * charset.length)] ?? " ";
}

function makeCell(ch: string): CellHandle {
  return {
    leaf: null,
    front: null,
    back: null,
    bottom: null,
    under: null,
    displayed: ch,
    hovering: false,
    token: 0,
  };
}

export function SolariFlap({
  value,
  charset = DEFAULT_CHARSET,
  cellWidth = 34,
  cellHeight = 50,
  className = "",
}: SolariFlapProps) {
  const chars = value.split("");

  const cellsRef = useRef<CellHandle[]>(chars.map((ch) => makeCell(ch)));
  if (cellsRef.current.length !== chars.length) {
    cellsRef.current = chars.map((ch, i) => cellsRef.current[i] ?? makeCell(ch));
  }

  const reducedRef = useRef(false);
  const boardPausedRef = useRef(false);
  const prevValueRef = useRef(value);
  const finalizeTimerRef = useRef<number | undefined>(undefined);
  const [announceText, setAnnounceText] = useState(value);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const landCell = (cell: CellHandle, ch: string) => {
    if (cell.leaf) {
      cell.leaf.style.transition = "none";
      cell.leaf.style.transform = cell.hovering ? `rotateX(${HOVER_LIFT_DEG}deg)` : "rotateX(0deg)";
    }
    if (cell.front) cell.front.textContent = ch;
    if (cell.bottom) cell.bottom.textContent = ch;
    if (cell.under) cell.under.textContent = pick(charset);
    cell.displayed = ch;
  };

  const runStep = (cell: CellHandle, targetCh: string, reduced: boolean) => {
    if (reduced || !cell.leaf || !cell.front || !cell.back) {
      landCell(cell, targetCh);
      return;
    }
    cell.back.textContent = targetCh;
    cell.leaf.style.transition = "none";
    cell.leaf.style.transform = "rotateX(0deg)";
    void cell.leaf.offsetHeight; // force reflow so the next transition applies
    cell.leaf.style.transition = `transform ${FLIP_MS}ms ${FLIP_EASE}`;
    cell.leaf.style.transform = "rotateX(-180deg)";
    window.setTimeout(() => {
      if (cell.bottom) cell.bottom.textContent = targetCh;
    }, FLIP_MS / 2);
    window.setTimeout(() => {
      landCell(cell, targetCh);
    }, FLIP_MS);
  };

  const scheduleCell = (index: number, targetCh: string) => {
    const cell = cellsRef.current[index];
    if (!cell) return;
    const myToken = ++cell.token;
    if (reducedRef.current) {
      runStep(cell, targetCh, true);
      return;
    }
    const steps = MIN_STEPS + Math.floor(Math.random() * (MAX_STEPS - MIN_STEPS + 1));
    const stagger = (STAGGER_MIN_MS + Math.random() * (STAGGER_MAX_MS - STAGGER_MIN_MS)) * (index + 1);
    let i = 0;
    const next = () => {
      if (cell.token !== myToken) return;
      if (boardPausedRef.current) {
        window.setTimeout(next, 90);
        return;
      }
      const isLast = i === steps - 1;
      runStep(cell, isLast ? targetCh : pick(charset), false);
      i++;
      if (i < steps) window.setTimeout(next, FLIP_MS + HOLD_MS);
    };
    window.setTimeout(next, stagger);
  };

  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;
    if (prev === value) return;

    chars.forEach((ch, i) => {
      if (cellsRef.current[i] && cellsRef.current[i]!.displayed !== ch) {
        scheduleCell(i, ch);
      }
    });

    window.clearTimeout(finalizeTimerRef.current);
    const settleDelay = reducedRef.current
      ? 0
      : STAGGER_MAX_MS * chars.length + (FLIP_MS + HOLD_MS) * MAX_STEPS + 120;
    finalizeTimerRef.current = window.setTimeout(() => setAnnounceText(value), settleDelay);
    return () => window.clearTimeout(finalizeTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleBoardEnter = () => {
    boardPausedRef.current = true;
  };
  const handleBoardLeave = () => {
    boardPausedRef.current = false;
  };

  const setHover = (cell: CellHandle, hovering: boolean) => {
    if (reducedRef.current) return;
    cell.hovering = hovering;
    if (!cell.leaf) return;
    cell.leaf.style.transition = `transform ${HOVER_MS}ms ${HOVER_EASE}, box-shadow ${HOVER_MS}ms ${HOVER_EASE}`;
    cell.leaf.style.transform = hovering ? `rotateX(${HOVER_LIFT_DEG}deg)` : "rotateX(0deg)";
    // The rotation alone is a 22deg tilt on a ~25px leaf; a growing
    // cast shadow underneath is the legible "lifted off the plate" cue a
    // real gap between flap and plate would throw.
    cell.leaf.style.boxShadow = hovering ? "0 5px 8px -1px rgba(0,0,0,0.55)" : "none";
  };

  return (
    <div
      className={`ns-sf-board ${className}`}
      onPointerEnter={handleBoardEnter}
      onPointerLeave={handleBoardLeave}
    >
      <style>{CSS}</style>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announceText}
      </span>
      <div className="ns-sf-row">
        {chars.map((ch, i) => (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="ns-sf-cell"
            style={
              {
                "--sf-w": `${cellWidth}px`,
                "--sf-h": `${cellHeight}px`,
              } as React.CSSProperties
            }
            onPointerEnter={() => setHover(cellsRef.current[i]!, true)}
            onPointerLeave={() => setHover(cellsRef.current[i]!, false)}
          >
            <span
              className="ns-sf-plate ns-sf-under"
              ref={(el) => {
                if (cellsRef.current[i]) cellsRef.current[i]!.under = el;
              }}
            >
              {ch}
            </span>
            <span
              className="ns-sf-plate ns-sf-bottom"
              ref={(el) => {
                if (cellsRef.current[i]) cellsRef.current[i]!.bottom = el;
              }}
            >
              {ch}
            </span>
            <div className="ns-sf-leaf-clip">
              <div
                className="ns-sf-leaf"
                ref={(el) => {
                  if (cellsRef.current[i]) cellsRef.current[i]!.leaf = el;
                }}
              >
                <span
                  className="ns-sf-face ns-sf-face-front"
                  ref={(el) => {
                    if (cellsRef.current[i]) cellsRef.current[i]!.front = el;
                  }}
                >
                  {ch}
                </span>
                <span
                  className="ns-sf-face ns-sf-face-back"
                  ref={(el) => {
                    if (cellsRef.current[i]) cellsRef.current[i]!.back = el;
                  }}
                >
                  {ch}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const CSS = `
.ns-sf-board{display:inline-block;}
.ns-sf-row{display:flex;gap:3px;}
.ns-sf-cell{
  position:relative;
  width:var(--sf-w);
  height:var(--sf-h);
  padding:0;
  border:1px solid var(--border);
  border-radius:4px;
  background:var(--foreground);
  overflow:hidden;
  perspective:70px;
  cursor:default;
  -webkit-tap-highlight-color:transparent;
}
.ns-sf-plate{
  position:absolute;
  left:0;
  width:100%;
  height:50%;
  overflow:hidden;
  display:flex;
  justify-content:center;
  font-family:var(--font-geist-mono, ui-monospace, monospace);
  font-size:calc(var(--sf-h) * 0.52);
  line-height:var(--sf-h);
  color:var(--background);
}
.ns-sf-under{ top:0; align-items:flex-start; }
.ns-sf-bottom{
  bottom:0;
  align-items:flex-end;
  border-top:1px solid var(--background);
  box-shadow:inset 0 5px 6px -3px color-mix(in srgb, var(--background) 60%, transparent);
}
.ns-sf-leaf-clip{
  position:absolute;
  top:0;
  left:0;
  width:100%;
  height:50%;
  overflow:hidden;
  z-index:2;
}
.ns-sf-leaf{
  position:absolute;
  top:0;
  left:0;
  width:100%;
  height:100%;
  transform-style:preserve-3d;
  transform-origin:bottom center;
  transform:rotateX(0deg);
}
.ns-sf-face{
  position:absolute;
  top:0;
  left:0;
  width:100%;
  height:var(--sf-h);
  display:flex;
  align-items:center;
  justify-content:center;
  font-family:var(--font-geist-mono, ui-monospace, monospace);
  font-size:calc(var(--sf-h) * 0.52);
  color:var(--background);
  backface-visibility:hidden;
  -webkit-backface-visibility:hidden;
}
.ns-sf-face-front{ box-shadow:inset 0 -5px 6px -2px color-mix(in srgb, var(--background) 50%, transparent); }
.ns-sf-face-back{ transform:rotateX(180deg); box-shadow:inset 0 5px 6px -2px color-mix(in srgb, var(--background) 50%, transparent); }
@media (prefers-reduced-motion: reduce){
  .ns-sf-leaf{ transition:none !important; }
}
`;
