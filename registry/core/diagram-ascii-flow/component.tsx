"use client";

import { useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// AsciiFlowDiagram — a box-drawing flowchart where dragging a node re-routes
// every connector touching it LIVE, cell by cell, on a monospace glyph grid.
// Unlike tree-box-drawing (a fixed hierarchy whose connectors only change on
// expand/collapse) or container-box-drawing (a single static frame), the
// graph here has free node positions and an actual orthogonal router: each
// edge is traced as a Manhattan path (a single-bend Z, horizontal or
// vertical depending on whether the two nodes overlap in column or row) onto
// a shared occupancy grid, and every cell's glyph — a plain rule, a corner,
// or a junction (┼ ├ ┤ ┬ ┴) — is resolved from which of its four neighbor
// directions are actually in use THAT frame, recomputed from scratch on
// every node move. Clicking (not dragging) a node selects it and reports its
// live connection count in a small readout below the canvas; arrow keys move
// the currently-focused node by one grid cell, so re-routing is reachable
// without a pointer at all. Pure DOM text + CSS, zero dependencies.
// ---------------------------------------------------------------------------

export interface FlowNode {
  id: string;
  label: string;
}

export interface FlowEdge {
  from: string;
  to: string;
}

export interface AsciiFlowDiagramProps {
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  className?: string;
}

const COLS = 30;
const ROWS = 13;
const CELL_W = 12;
const CELL_H = 17;
const NODE_W = 7;
const NODE_H = 3;
const COL_MIN = 1;
const COL_MAX = COLS - NODE_W - 2;
const ROW_MIN = 1;
const ROW_MAX = ROWS - NODE_H - 2;

const DEFAULT_NODES: FlowNode[] = [
  { id: "ingest", label: "Ingest" },
  { id: "parse", label: "Parse" },
  { id: "route", label: "Route" },
  { id: "cache", label: "Cache" },
  { id: "merge", label: "Merge" },
  { id: "emit", label: "Emit" },
];

// A layered left-to-right DAG: every edge either connects the two stacked
// nodes within one column, or crosses to the immediately adjacent column at
// the SAME row — never a diagonal that skips a column and would otherwise
// cut straight through an unrelated node's box.
const DEFAULT_EDGES: FlowEdge[] = [
  { from: "ingest", to: "parse" },
  { from: "route", to: "cache" },
  { from: "merge", to: "emit" },
  { from: "ingest", to: "route" },
  { from: "parse", to: "cache" },
  { from: "route", to: "merge" },
  { from: "cache", to: "emit" },
];

const INITIAL_POS: Record<string, { col: number; row: number }> = {
  ingest: { col: 1, row: 1 },
  parse: { col: 1, row: 7 },
  route: { col: 11, row: 1 },
  cache: { col: 11, row: 7 },
  merge: { col: 21, row: 1 },
  emit: { col: 21, row: 7 },
};

// Direction bits: North / East / South / West.
const N = 1;
const E = 2;
const S = 4;
const W = 8;

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

function dirBit(dx: number, dy: number): number {
  if (dx === 1) return E;
  if (dx === -1) return W;
  if (dy === 1) return S;
  if (dy === -1) return N;
  return 0;
}
const OPPOSITE: Record<number, number> = { [N]: S, [S]: N, [E]: W, [W]: E };

function tracePolyline(points: [number, number][], grid: Map<string, number>) {
  for (let s = 0; s < points.length - 1; s++) {
    let [x, y] = points[s];
    const [ex, ey] = points[s + 1];
    const dx = Math.sign(ex - x);
    const dy = Math.sign(ey - y);
    if (dx !== 0 && dy !== 0) continue; // segments are always axis-aligned
    while (x !== ex || y !== ey) {
      const nx = x + dx;
      const ny = y + dy;
      const out = dirBit(dx, dy);
      const into = OPPOSITE[out];
      const key1 = `${x},${y}`;
      const key2 = `${nx},${ny}`;
      grid.set(key1, (grid.get(key1) ?? 0) | out);
      grid.set(key2, (grid.get(key2) ?? 0) | into);
      x = nx;
      y = ny;
    }
  }
}

type Pos = { col: number; row: number };

function edgePath(src: Pos, dst: Pos): [number, number][] {
  const colsOverlap = !(dst.col + NODE_W <= src.col || src.col + NODE_W <= dst.col);
  if (!colsOverlap) {
    // side by side: route from right/left mid-edge, single-bend Z on X
    const srcRight = dst.col > src.col;
    const ex = srcRight ? src.col + NODE_W : src.col - 1;
    const ey = src.row + 1;
    const tx = srcRight ? dst.col - 1 : dst.col + NODE_W;
    const ty = dst.row + 1;
    if (ey === ty) return [[ex, ey], [tx, ty]];
    const midX = Math.round((ex + tx) / 2);
    return [
      [ex, ey],
      [midX, ey],
      [midX, ty],
      [tx, ty],
    ];
  }
  // stacked: route from bottom/top mid-edge, single-bend Z on Y
  const srcBelow = dst.row > src.row;
  const midCol = Math.floor(NODE_W / 2);
  const ex = src.col + midCol;
  const ey = srcBelow ? src.row + NODE_H : src.row - 1;
  const tx = dst.col + midCol;
  const ty = srcBelow ? dst.row - 1 : dst.row + NODE_H;
  if (ex === tx) return [[ex, ey], [tx, ty]];
  const midY = Math.round((ey + ty) / 2);
  return [
    [ex, ey],
    [ex, midY],
    [tx, midY],
    [tx, ty],
  ];
}

function rectsOverlap(a: Pos, b: Pos, buffer: number): boolean {
  return !(
    a.col + NODE_W + buffer <= b.col ||
    b.col + NODE_W + buffer <= a.col ||
    a.row + NODE_H + buffer <= b.row ||
    b.row + NODE_H + buffer <= a.row
  );
}

// This component used to color every node via JS: read --foreground/
// --background/etc with getComputedStyle at mount, hold them in state, patch
// a MutationObserver on <html> to react to theme flips, and apply the result
// as raw hex through inline `style`. That's a real bug, not just an unusual
// choice: SSR always runs with no `document`, so the FIRST server-rendered
// markup is baked with the light-theme fallback hex; React's hydration does
// not force every mismatched inline-style property to the client's value the
// way it does for text content, so on a genuinely dark-themed load the
// node's `background` inline style silently stayed the SSR-fallback white
// forever — confirmed live: the component's own render logged the correct
// dark hex on every pass while the DOM's computed background-color stayed
// white indefinitely, because that particular value never CHANGED between
// renders (React only patches a DOM attribute when the new render's value
// differs from the previous render's, not from whatever's actually painted).
// Tailwind classes bound to the same custom properties sidestep the whole
// class of bug: the cascade resolves --background per theme at PAINT time,
// with no JS/hydration step in the loop at all.
export function AsciiFlowDiagram({
  nodes = DEFAULT_NODES,
  edges = DEFAULT_EDGES,
  className = "",
}: AsciiFlowDiagramProps) {
  const [positions, setPositions] = useState<Record<string, Pos>>(() => {
    const init: Record<string, Pos> = {};
    nodes.forEach((n) => {
      init[n.id] = INITIAL_POS[n.id] ?? { col: 1, row: 1 };
    });
    return init;
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const dragState = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    startCol: number;
    startRow: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const grid = useMemo(() => {
    const g = new Map<string, number>();
    for (const edge of edges) {
      const src = positions[edge.from];
      const dst = positions[edge.to];
      if (!src || !dst) continue;
      tracePolyline(edgePath(src, dst), g);
    }
    return g;
  }, [positions, edges]);

  const rows = useMemo(() => {
    const out: string[] = [];
    for (let y = 0; y < ROWS; y++) {
      let line = "";
      for (let x = 0; x < COLS; x++) {
        const mask = grid.get(`${x},${y}`) ?? 0;
        line += GLYPH[mask] ?? " ";
      }
      out.push(line);
    }
    return out;
  }, [grid]);

  const connectionsFor = (id: string) => edges.filter((e) => e.from === id || e.to === id).length;

  const clampPos = (col: number, row: number, id: string): Pos => {
    const nc = Math.max(COL_MIN, Math.min(COL_MAX, col));
    const nr = Math.max(ROW_MIN, Math.min(ROW_MAX, row));
    const candidate = { col: nc, row: nr };
    for (const other of nodes) {
      if (other.id === id) continue;
      const op = positions[other.id];
      if (op && rectsOverlap(candidate, op, 1)) {
        return positions[id];
      }
    }
    return candidate;
  };

  const onPointerDown = (id: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCol: positions[id].col,
      startRow: positions[id].row,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragState.current;
    if (!drag) return;
    const dCol = Math.round((e.clientX - drag.startClientX) / CELL_W);
    const dRow = Math.round((e.clientY - drag.startClientY) / CELL_H);
    if (dCol === 0 && dRow === 0) return;
    drag.moved = true;
    const next = clampPos(drag.startCol + dCol, drag.startRow + dRow, drag.id);
    setPositions((p) => (p[drag.id].col === next.col && p[drag.id].row === next.row ? p : { ...p, [drag.id]: next }));
  };

  const endDrag = () => {
    suppressClickRef.current = dragState.current?.moved ?? false;
    dragState.current = null;
  };

  const nudge = (id: string, dCol: number, dRow: number) => {
    const cur = positions[id];
    const next = clampPos(cur.col + dCol, cur.row + dRow, id);
    setPositions((p) => ({ ...p, [id]: next }));
  };

  return (
    <div className={`ns-daf font-mono ${className}`}>
      <style>{CSS}</style>
      <div
        className="ns-daf-canvas relative select-none"
        style={{ width: COLS * CELL_W, height: ROWS * CELL_H, maxWidth: "100%" }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) setSelectedId(null);
        }}
      >
        {/* Each character is its own fixed-width span rather than one flowing
            text string per row: a browser's real monospace glyph advance
            almost never equals CELL_W exactly (measured ~13.75px at this
            font-size vs the assumed 12px), and the connector grid must land
            on the SAME px grid the absolutely-positioned node buttons use —
            a flowing string drifts column alignment cumulatively across the
            row until connectors miss the node edges they're meant to touch. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 text-ns-muted" style={{ fontSize: 11 }}>
          {rows.map((line, y) => (
            <div key={y} style={{ height: CELL_H, lineHeight: `${CELL_H}px`, whiteSpace: "nowrap" }}>
              {line.split("").map((ch, x) => (
                <span key={x} style={{ display: "inline-block", width: CELL_W, textAlign: "center" }}>
                  {ch}
                </span>
              ))}
            </div>
          ))}
        </div>

        {nodes.map((n) => {
          const pos = positions[n.id];
          const selected = selectedId === n.id;
          const hovered = hoverId === n.id;
          return (
            <button
              key={n.id}
              type="button"
              data-diagram-node={n.id}
              className={`ns-daf-node absolute flex items-center justify-center border bg-background text-[11px] transition-colors duration-150 motion-reduce:transition-none ${
                selected
                  ? "border-ns-accent text-foreground"
                  : hovered
                    ? "border-ns-accent/40 text-foreground"
                    : "border-border text-ns-muted"
              }`}
              style={{
                left: pos.col * CELL_W,
                top: pos.row * CELL_H,
                width: NODE_W * CELL_W,
                height: NODE_H * CELL_H,
                cursor: "grab",
              }}
              aria-label={`${n.label} node, ${connectionsFor(n.id)} connection${connectionsFor(n.id) === 1 ? "" : "s"}. Press Enter to select, arrow keys to move.`}
              aria-pressed={selected}
              onPointerEnter={() => setHoverId(n.id)}
              onPointerLeave={() => setHoverId((c) => (c === n.id ? null : c))}
              onPointerDown={onPointerDown(n.id)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={() => {
                dragState.current = null;
              }}
              onClick={() => {
                // pointerup always fires a trailing click on the captured
                // element; a real drag (moved) suppresses it here so
                // dragging a node never also toggles its selection. Keyboard
                // activation (Enter/Space) never touches pointer handlers at
                // all, so it always reaches this branch and selects.
                // Deliberately not a toggle: clicking an already-selected
                // node re-selecting itself is a no-op state-wise, never a
                // deselect — deselect is Escape or clicking empty canvas
                // only, so a repeated click on the same node (e.g. a second
                // automated press) can't silently clear the readout.
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                setSelectedId(n.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  nudge(n.id, 0, -1);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  nudge(n.id, 0, 1);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  nudge(n.id, -1, 0);
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  nudge(n.id, 1, 0);
                } else if (e.key === "Escape") {
                  setSelectedId(null);
                }
              }}
            >
              {n.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 min-h-[1.5em] font-mono text-xs text-ns-muted">
        {selectedId ? (
          <span data-diagram-selection>
            Selected: <strong className="text-foreground">{nodes.find((n) => n.id === selectedId)?.label}</strong> —{" "}
            {connectionsFor(selectedId)} connection{connectionsFor(selectedId) === 1 ? "" : "s"}
          </span>
        ) : (
          <span>Click or select a node to inspect its connections.</span>
        )}
      </div>
    </div>
  );
}

const CSS = `
.ns-daf-node:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: 2px; }
`;
