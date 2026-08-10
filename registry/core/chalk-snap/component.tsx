"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// ChalkSnap — a freehand annotation layer that quantizes every pointer
// stroke live onto the character grid as box-drawing glyphs. You scribble
// over `children` (a UI, a doc, a code block — anything) and the result is
// real, copyable text, not an image. Distinct from diagram-ascii-flow: that
// component renders a GIVEN graph (nodes/edges as data) to ASCII — a
// post-hoc conversion. Here nothing is given; a human draws, and the grid
// disciplines the hand in real time. There is no data model to feed it.
//
// MECHANISM: an invisible 1ch x 1lh cell grid overlays `children` (measured
// the same way container-box-drawing measures its content box: a hidden
// probe span + ResizeObserver, so the grid always tiles in whole
// characters regardless of what's underneath). A pointer stroke is sampled
// on every pointermove; `walkStroke` converts the continuous pointer
// position into a discrete cell-by-cell walk, one axis at a time, using a
// hysteresis margin (HYSTERESIS) so a hand that's basically moving right
// but wobbles a few px vertically doesn't flicker between horizontal and
// vertical classification mid-stroke — the walk keeps favoring whichever
// axis it was already committed to until the other axis clearly wins.
// Every committed step OR-accumulates a 4-bit N/E/S/W direction mask into a
// shared cell map (same bitmask -> glyph table as diagram-ascii-flow), so
// junctions where strokes cross or meet resolve from neighbor bits alone
// (├ ┬ ┼ ...). A stroke end whose trailing pointer speed clears
// ARROW_VELOCITY gets an arrowhead (► ◄ ▲ ▼) in its direction of travel.
//
// SETTLE: each newly-touched cell remounts (its React key includes a
// generation counter) with a raw-position offset baked into CSS custom
// properties, so it fades in scaling from wherever the actual pointer was
// when the cell committed to the cell's true center — a short
// ease-out-expo settle (cubic-bezier(.16,1,.3,1), the same curve used
// across this registry). A trailing SVG polyline (accent-colored — the
// only place --ns-accent touches drawn ink) shows the raw uncorrected path
// for ~220ms after pointerup, then dissolves, so the hand-drawn gesture and
// its disciplined result are both visible for a moment before only the
// glyphs remain.
//
// KEYBOARD: the grid is a single focusable region. Arrow keys move a
// visible accent-outlined cursor (shown only while the region has focus).
// Shift+Arrow lays one segment through the exact same commit path pointer
// strokes use, grouping consecutive shift-moves into one semantic run; a
// plain arrow move (or Escape) closes the run. Enter caps the open run
// with an arrowhead in its last direction. Nothing here needs a pointer.
//
// A11Y: the glyph raster is aria-hidden (a screen reader reading "box
// drawings light horizontal" cell by cell forever helps no one). A
// visually-hidden <ul> is the shadow description instead — one plain-
// language line per completed stroke ("arrow from row 3 col 10 to row 3
// col 42"), always in sync with what's drawn. Copy is async (Clipboard
// API), so its result lands in a role=status/aria-live=polite region, not
// silently. Tokens only: drawn ink is --foreground, the trail and cursor
// are --ns-accent, everything else --border/--ns-muted.
// ---------------------------------------------------------------------------

const N = 1;
const E = 2;
const S = 4;
const W = 8;
const OPPOSITE: Record<number, number> = { [N]: S, [S]: N, [E]: W, [W]: E };

const GLYPH: Record<number, string> = {
  0: " ",
  1: "│",
  2: "─",
  4: "│",
  8: "─",
  5: "│", // N+S
  10: "─", // E+W
  3: "└", // N+E
  9: "┘", // N+W
  6: "┌", // S+E
  12: "┐", // S+W
  7: "├", // N+E+S
  13: "┤", // N+W+S
  14: "┬", // E+W+S
  11: "┴", // E+W+N
  15: "┼", // all four
};

const ARROW: Record<number, string> = { [N]: "▲", [E]: "►", [S]: "▼", [W]: "◄" };

// how far a movement has to clear before it counts as "at" the next cell
const STEP_THRESHOLD = 0.5;
// once committed to an axis, the other axis has to beat it by this much
// (in cell units) before the walk switches — kills wobble-driven flicker
const HYSTERESIS = 0.35;
// smoothed px/ms trailing speed above which a stroke end gets an arrowhead
const ARROW_VELOCITY = 0.55;
const GLYPH_PX = 11; // font-size the raster is painted at; the cell probe matches it
const MAX_WALK_STEPS = 64;

type CellState = { mask: number; gen: number; arrow?: string; ox: number; oy: number };
type Vars = CSSProperties & Record<`--${string}`, string | number>;

type Stroke = { id: number; fromRow: number; fromCol: number; toRow: number; toCol: number; arrow: boolean };

type StrokeWalk = {
  pointerId: number;
  startCol: number;
  startRow: number;
  curCol: number;
  curRow: number;
  lastAxis: "h" | "v" | null;
  lastDir: number | null;
  touched: boolean;
  lastT: number;
  lastX: number;
  lastY: number;
  velocity: number | null;
};

type KeyboardRun = { startCol: number; startRow: number; lastDir: number | null };

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function describeStroke(s: Stroke): string {
  const kind = s.arrow ? "Arrow" : "Line";
  return `${kind} from row ${s.fromRow + 1} col ${s.fromCol + 1} to row ${s.toRow + 1} col ${s.toCol + 1}`;
}

export interface ChalkSnapProps {
  /** the UI, doc, or code region being annotated. Optional — omit for a blank grid sized by cols/rows. */
  children?: ReactNode;
  /** fixed column count; when omitted, derived from the measured content box */
  cols?: number;
  /** fixed row count; when omitted, derived from the measured content box */
  rows?: number;
  className?: string;
}

export function ChalkSnap({ children, cols: colsProp, rows: rowsProp, className = "" }: ChalkSnapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const [cellPx, setCellPx] = useState({ w: 7, h: 16 });
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [tick, setTick] = useState(0);
  const [cursor, setCursor] = useState({ col: 0, row: 0 });
  const [focused, setFocused] = useState(false);
  const [rawPoints, setRawPoints] = useState<{ x: number; y: number }[]>([]);
  const [trailFading, setTrailFading] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [copyStatus, setCopyStatus] = useState("");

  const cellMap = useRef(new Map<string, CellState>());
  const strokeIdRef = useRef(0);
  const walkRef = useRef<StrokeWalk | null>(null);
  const keyboardRunRef = useRef<KeyboardRun | null>(null);
  const fadeTimeoutRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const probe = probeRef.current;
    if (!host || !probe) return;
    const measure = () => {
      const cell = probe.getBoundingClientRect();
      const b = host.getBoundingClientRect();
      if (cell.width > 0 && cell.height > 0) setCellPx({ w: cell.width, h: cell.height });
      setBox({ w: b.width, h: b.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    document.fonts.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, []);

  const cols = colsProp ?? Math.max(4, Math.floor(box.w / cellPx.w) || 4);
  const rows = rowsProp ?? Math.max(3, Math.floor(box.h / cellPx.h) || 3);

  function cellKey(x: number, y: number) {
    return `${x},${y}`;
  }

  // OR-accumulates one direction bit into a cell; a genuinely new bit bumps
  // that cell's generation counter, which forces the glyph span to remount
  // and replay its settle-in animation
  function applyBit(x: number, y: number, bit: number, ox = 0, oy = 0) {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return;
    const key = cellKey(x, y);
    const prev = cellMap.current.get(key);
    if (prev && (prev.mask & bit) === bit) return;
    const mask = (prev?.mask ?? 0) | bit;
    cellMap.current.set(key, { mask, gen: (prev?.gen ?? 0) + 1, arrow: prev?.arrow, ox, oy });
  }

  function setArrow(x: number, y: number, dir: number) {
    const key = cellKey(x, y);
    const prev = cellMap.current.get(key);
    if (!prev) return;
    cellMap.current.set(key, { ...prev, gen: prev.gen + 1, arrow: ARROW[dir] });
  }

  function recordStroke(fromCol: number, fromRow: number, toCol: number, toRow: number, arrow: boolean) {
    if (fromCol === toCol && fromRow === toRow) return;
    strokeIdRef.current += 1;
    setStrokes((prev) => [...prev, { id: strokeIdRef.current, fromRow, fromCol, toRow, toCol, arrow }]);
  }

  // walks a continuous pointer position toward its cell one grid step at a
  // time, committing direction bits as it goes — the live quantization
  function walkTo(s: StrokeWalk, fcol: number, frow: number) {
    let steps = 0;
    while (steps++ < MAX_WALK_STEPS) {
      const dx = fcol - s.curCol;
      const dy = frow - s.curRow;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax < STEP_THRESHOLD && ay < STEP_THRESHOLD) break;
      let axis: "h" | "v";
      if (ax >= STEP_THRESHOLD && ay >= STEP_THRESHOLD) {
        if (s.lastAxis === "h" && ax + HYSTERESIS >= ay) axis = "h";
        else if (s.lastAxis === "v" && ay + HYSTERESIS >= ax) axis = "v";
        else axis = ax >= ay ? "h" : "v";
      } else {
        axis = ax >= STEP_THRESHOLD ? "h" : "v";
      }
      const dir = axis === "h" ? (dx > 0 ? E : W) : dy > 0 ? S : N;
      const nx = s.curCol + (dir === E ? 1 : dir === W ? -1 : 0);
      const ny = s.curRow + (dir === S ? 1 : dir === N ? -1 : 0);
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) break;
      const ox = (fcol - nx) * cellPx.w;
      const oy = (frow - ny) * cellPx.h;
      applyBit(s.curCol, s.curRow, dir);
      applyBit(nx, ny, OPPOSITE[dir], ox, oy);
      s.curCol = nx;
      s.curRow = ny;
      s.lastAxis = axis;
      s.lastDir = dir;
      s.touched = true;
    }
  }

  function clearFadeTimeout() {
    if (fadeTimeoutRef.current !== null) {
      window.clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
  }

  function endTrail() {
    setTrailFading(true);
    clearFadeTimeout();
    fadeTimeoutRef.current = window.setTimeout(() => {
      setRawPoints([]);
      setTrailFading(false);
    }, 220);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = gridRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const startCol = clamp(Math.round(x / cellPx.w), 0, cols - 1);
    const startRow = clamp(Math.round(y / cellPx.h), 0, rows - 1);
    walkRef.current = {
      pointerId: e.pointerId,
      startCol,
      startRow,
      curCol: startCol,
      curRow: startRow,
      lastAxis: null,
      lastDir: null,
      touched: false,
      lastT: e.timeStamp,
      lastX: x,
      lastY: y,
      velocity: null,
    };
    clearFadeTimeout();
    setTrailFading(false);
    setRawPoints([{ x, y }]);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = walkRef.current;
    const el = gridRef.current;
    if (!s || !el || s.pointerId !== e.pointerId) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dt = Math.max(1, e.timeStamp - s.lastT);
    const dist = Math.hypot(x - s.lastX, y - s.lastY);
    const v = dist / dt;
    s.velocity = s.velocity === null ? v : s.velocity * 0.6 + v * 0.4;
    s.lastT = e.timeStamp;
    s.lastX = x;
    s.lastY = y;
    walkTo(s, x / cellPx.w, y / cellPx.h);
    setRawPoints((prev) => (prev.length > 80 ? [...prev.slice(-80), { x, y }] : [...prev, { x, y }]));
    setTick((t) => t + 1);
  }

  function finishStroke(pointerId: number) {
    const s = walkRef.current;
    if (!s || s.pointerId !== pointerId) return;
    walkRef.current = null;
    if (s.touched) {
      const isArrow = (s.velocity ?? 0) > ARROW_VELOCITY && s.lastDir !== null;
      if (isArrow && s.lastDir !== null) setArrow(s.curCol, s.curRow, s.lastDir);
      recordStroke(s.startCol, s.startRow, s.curCol, s.curRow, isArrow);
      setTick((t) => t + 1);
    }
    endTrail();
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    finishStroke(e.pointerId);
  }

  function onPointerCancel() {
    walkRef.current = null;
    endTrail();
  }

  function moveCursor(dcol: number, drow: number, shift: boolean) {
    const nc = clamp(cursor.col + dcol, 0, cols - 1);
    const nr = clamp(cursor.row + drow, 0, rows - 1);
    if (nc === cursor.col && nr === cursor.row) return;
    if (shift) {
      const dir = dcol !== 0 ? (dcol > 0 ? E : W) : drow > 0 ? S : N;
      applyBit(cursor.col, cursor.row, dir);
      applyBit(nc, nr, OPPOSITE[dir], 0, 0);
      if (!keyboardRunRef.current) keyboardRunRef.current = { startCol: cursor.col, startRow: cursor.row, lastDir: dir };
      else keyboardRunRef.current.lastDir = dir;
      setTick((t) => t + 1);
    } else if (keyboardRunRef.current) {
      recordStroke(keyboardRunRef.current.startCol, keyboardRunRef.current.startRow, cursor.col, cursor.row, false);
      keyboardRunRef.current = null;
    }
    setCursor({ col: nc, row: nr });
  }

  function capArrow() {
    const run = keyboardRunRef.current;
    if (!run || run.lastDir === null) return;
    setArrow(cursor.col, cursor.row, run.lastDir);
    recordStroke(run.startCol, run.startRow, cursor.col, cursor.row, true);
    keyboardRunRef.current = null;
    setTick((t) => t + 1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        moveCursor(0, -1, e.shiftKey);
        return;
      case "ArrowDown":
        e.preventDefault();
        moveCursor(0, 1, e.shiftKey);
        return;
      case "ArrowLeft":
        e.preventDefault();
        moveCursor(-1, 0, e.shiftKey);
        return;
      case "ArrowRight":
        e.preventDefault();
        moveCursor(1, 0, e.shiftKey);
        return;
      case "Enter":
        e.preventDefault();
        capArrow();
        return;
      case "Escape":
        keyboardRunRef.current = null;
        return;
      default:
        return;
    }
  }

  function raster(): string {
    const lines: string[] = [];
    for (let y = 0; y < rows; y++) {
      let line = "";
      for (let x = 0; x < cols; x++) {
        const cell = cellMap.current.get(cellKey(x, y));
        line += cell?.arrow ?? (cell ? (GLYPH[cell.mask] ?? " ") : " ");
      }
      lines.push(line.replace(/\s+$/, ""));
    }
    return lines.join("\n");
  }

  async function handleCopy() {
    const text = raster();
    if (!text.trim()) {
      setCopyStatus("Nothing drawn yet — nothing to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(`Copied ${cols}x${rows} raster to clipboard.`);
    } catch {
      setCopyStatus("Copy failed — clipboard unavailable.");
    }
  }

  function handleClear() {
    cellMap.current.clear();
    keyboardRunRef.current = null;
    walkRef.current = null;
    clearFadeTimeout();
    setRawPoints([]);
    setTrailFading(false);
    setStrokes([]);
    setCopyStatus("Cleared.");
    setCursor({ col: 0, row: 0 });
    setTick((t) => t + 1);
  }

  const glyphRows = useMemo(() => {
    const out: ReactNode[] = [];
    for (let y = 0; y < rows; y++) {
      const spans: ReactNode[] = [];
      for (let x = 0; x < cols; x++) {
        const cell = cellMap.current.get(cellKey(x, y));
        const ch = cell?.arrow ?? (cell ? (GLYPH[cell.mask] ?? " ") : " ");
        const animated = !!cell && (cell.mask !== 0 || !!cell.arrow);
        const style: Vars = {
          width: cellPx.w,
          textAlign: "center",
          "--ns-cs-ox": `${cell?.ox ?? 0}px`,
          "--ns-cs-oy": `${cell?.oy ?? 0}px`,
        };
        spans.push(
          <span
            key={animated ? `${x},${y}-${cell!.gen}` : `${x},${y}`}
            className={animated ? "ns-cs-glyph-in inline-block" : "inline-block"}
            style={style}
          >
            {ch}
          </span>
        );
      }
      out.push(
        <div key={y} style={{ height: cellPx.h, lineHeight: `${cellPx.h}px`, whiteSpace: "nowrap" }}>
          {spans}
        </div>
      );
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, cols, rows, cellPx.w, cellPx.h]);

  const hostStyle: CSSProperties | undefined = children ? undefined : { width: cols * cellPx.w, height: rows * cellPx.h };
  const run = keyboardRunRef.current;

  return (
    <div className={`ns-cs font-mono ${className}`}>
      <style>{CSS}</style>
      <div ref={hostRef} className="ns-cs-host relative inline-block max-w-full" style={hostStyle}>
        {children}
        <span
          ref={probeRef}
          aria-hidden
          className="pointer-events-none absolute opacity-0"
          // GLYPH_PX, not the inherited size: the cell must be exactly one
          // character of the font the raster is DRAWN in. Measuring 1ch/1lh at
          // the inherited 16px while painting glyphs at 11px left every
          // box-drawing run visibly gapped — a "continuous" line rendered as
          // dashes, both horizontally and vertically.
          // lineHeight "normal" is not cosmetic: measured in-browser, Geist
          // Mono's "│" ink fills exactly the NORMAL line box, so a row pitch of
          // 1lh-at-normal is the only one where a vertical run tiles without
          // gaps (1.5 — the inherited value — leaves a visible dash pattern).
          style={{ width: "1ch", height: "1lh", top: 0, left: 0, fontSize: GLYPH_PX, lineHeight: "normal" }}
        >
          M
        </span>
        <div
          ref={gridRef}
          data-chalk-snap-grid
          tabIndex={0}
          aria-label="Freehand annotation grid. Drag to draw a stroke that snaps to box-drawing characters; focus and use arrow keys to move the cursor, hold Shift with an arrow key to draw a segment, Enter caps the current segment with an arrowhead."
          className="ns-cs-grid absolute inset-0 cursor-crosshair touch-none select-none outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
        >
          <div aria-hidden className="ns-cs-glyphs pointer-events-none absolute inset-0 text-foreground" style={{ fontSize: GLYPH_PX }}>
            {glyphRows}
          </div>

          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
            {rawPoints.length > 1 && (
              <polyline
                points={rawPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="var(--ns-accent)"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`ns-cs-trail ${trailFading ? "ns-cs-trail-out" : ""}`}
              />
            )}
          </svg>

          <div
            aria-hidden
            className={`ns-cs-cursor pointer-events-none absolute ${focused ? "ns-cs-cursor-visible" : ""}`}
            style={{ left: cursor.col * cellPx.w, top: cursor.row * cellPx.h, width: cellPx.w, height: cellPx.h }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-xs text-ns-muted">
        <span data-chalk-snap-readout>
          Row {cursor.row + 1}, Col {cursor.col + 1}
          {run ? " — segment open, Enter to cap" : ""}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-[6px] border border-border px-2 py-1 text-foreground transition-colors duration-150 hover:border-ns-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent motion-reduce:transition-none"
        >
          Copy raster
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-[6px] border border-border px-2 py-1 text-foreground transition-colors duration-150 hover:border-ns-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent motion-reduce:transition-none"
        >
          Clear
        </button>
        <span role="status" aria-live="polite" className="text-ns-muted">
          {copyStatus}
        </span>
      </div>

      <ul className="sr-only" aria-label="Drawn strokes, described">
        {strokes.length === 0 ? <li>No strokes drawn yet.</li> : strokes.map((s) => <li key={s.id}>{describeStroke(s)}</li>)}
      </ul>
    </div>
  );
}

const CSS = `
.ns-cs-glyph-in {
  animation: ns-cs-settle 220ms cubic-bezier(.16,1,.3,1) both;
}
@keyframes ns-cs-settle {
  0% { opacity: 0; transform: translate(var(--ns-cs-ox, 0px), var(--ns-cs-oy, 0px)) scale(0.45); }
  100% { opacity: 1; transform: translate(0, 0) scale(1); }
}
.ns-cs-trail {
  opacity: 1;
  transition: opacity 200ms ease-out;
}
.ns-cs-trail-out {
  opacity: 0;
}
.ns-cs-cursor {
  box-sizing: border-box;
  border: 1px solid var(--ns-accent);
  border-radius: 2px;
  opacity: 0;
  transition: opacity 150ms ease-out, left 80ms ease-out, top 80ms ease-out;
}
.ns-cs-cursor-visible {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .ns-cs-glyph-in { animation: none !important; }
  .ns-cs-trail, .ns-cs-cursor { transition: none !important; }
}
`;
