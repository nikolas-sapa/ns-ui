"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SeatmapAsciiPick — an ASCII floor plan where a drag marquee selects a
// CONTIGUOUS block of seats, not one seat at a time. Taken seats and the
// aisle gap are both "unavailable" for the purpose of contiguity: dragging a
// marquee across a row that contains one breaks the run right there, and the
// selection snaps to the single longest unbroken run of available seats
// inside the marquee's row span — never the raw rectangle, which is what
// makes "unavailable cells break the block" visible rather than assumed.
// Distinct from grid-magnetic-lattice (ambient cursor field, nothing is
// selected) and filter-facet-mesh (toggling a SET of facet chips, not a
// contiguous run of grid cells). No canvas: every glyph is a real DOM
// button/span, colored from tokens via Tailwind classes only.
// ---------------------------------------------------------------------------

type SeatStatus = "available" | "taken" | "aisle";
type Cell = { r: number; c: number };

export interface SeatmapAsciiPickProps {
  /** rows x cols seat status grid */
  seats?: SeatStatus[][];
  rowLabels?: string[];
  colLabels?: string[];
  sectionLabel?: string;
  className?: string;
}

const A: SeatStatus = "available";
const T: SeatStatus = "taken";
const G: SeatStatus = "aisle";

const DEFAULT_SEATS: SeatStatus[][] = [
  [A, A, T, A, A, G, A, A, A, T, A],
  [A, A, A, A, T, G, A, A, T, A, A],
  [T, A, A, A, A, G, A, A, A, A, A],
  [A, A, A, T, A, G, A, T, A, A, A],
  [A, T, A, A, A, G, A, A, A, A, T],
  [A, A, A, A, A, G, T, A, A, A, A],
];

const DEFAULT_ROW_LABELS = ["ROW 8", "ROW 9", "ROW 10", "ROW 11", "ROW 12", "ROW 13"];
const DEFAULT_COL_LABELS = ["A", "B", "C", "D", "E", "", "F", "G", "H", "I", "J"];

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** longest unbroken run of available seats, within [left,right], across every row in [top,bottom] */
function bestRun(seats: SeatStatus[][], top: number, bottom: number, left: number, right: number) {
  let best: { r: number; start: number; end: number } | null = null;
  for (let r = top; r <= bottom; r++) {
    let runStart = -1;
    for (let c = left; c <= right + 1; c++) {
      const status = c <= right ? seats[r]?.[c] : "taken"; // sentinel to flush a trailing run
      if (status === "available") {
        if (runStart === -1) runStart = c;
      } else {
        if (runStart !== -1) {
          const len = c - runStart;
          if (!best || len > best.end - best.start + 1) {
            best = { r, start: runStart, end: c - 1 };
          }
        }
        runStart = -1;
      }
    }
  }
  return best;
}

export function SeatmapAsciiPick({
  seats = DEFAULT_SEATS,
  rowLabels = DEFAULT_ROW_LABELS,
  colLabels = DEFAULT_COL_LABELS,
  sectionLabel = "SECTION C",
  className = "",
}: SeatmapAsciiPickProps) {
  const rows = seats.length;
  const cols = seats[0]?.length ?? 0;

  const [anchor, setAnchor] = useState<Cell | null>(null);
  const [focus, setFocus] = useState<Cell | null>(null);
  const draggingRef = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const run = useMemo(() => {
    if (!anchor || !focus) return null;
    const top = Math.min(anchor.r, focus.r);
    const bottom = Math.max(anchor.r, focus.r);
    const left = Math.min(anchor.c, focus.c);
    const right = Math.max(anchor.c, focus.c);
    return bestRun(seats, top, bottom, left, right);
  }, [anchor, focus, seats]);

  const startDrag = (cell: Cell) => {
    if (seats[cell.r]?.[cell.c] === "aisle") return;
    draggingRef.current = true;
    setAnchor(cell);
    setFocus(cell);
  };

  const dragTo = (cell: Cell) => {
    if (draggingRef.current) setFocus(cell);
  };

  useEffect(() => {
    const end = () => {
      draggingRef.current = false;
    };
    window.addEventListener("pointerup", end);
    return () => window.removeEventListener("pointerup", end);
  }, []);

  const focusSeatButton = (r: number, c: number) => {
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-r="${r}"][data-c="${c}"]`)?.focus();
  };

  const nextAvailable = useCallback(
    (r: number, c: number, dc: number): number => {
      let nc = c;
      for (let i = 0; i < cols; i++) {
        nc = clamp(nc + dc, 0, cols - 1);
        if (seats[r]?.[nc] !== "aisle") return nc;
        if (nc === 0 || nc === cols - 1) return nc;
      }
      return c;
    },
    [cols, seats]
  );

  const onKeyDown = (e: React.KeyboardEvent, cell: Cell) => {
    const map: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const delta = map[e.key];
    if (!delta) return;
    e.preventDefault();
    let nr = clamp(cell.r + delta[0], 0, rows - 1);
    let nc = clamp(cell.c + delta[1], 0, cols - 1);
    if (delta[1] !== 0) nc = nextAvailable(cell.r, cell.c, delta[1]);
    if (seats[nr]?.[nc] === "aisle") return;
    if (e.shiftKey) {
      setAnchor((a) => a ?? cell);
      setFocus({ r: nr, c: nc });
    } else {
      setAnchor({ r: nr, c: nc });
      setFocus({ r: nr, c: nc });
    }
    focusSeatButton(nr, nc);
  };

  const inRun = (r: number, c: number) => !!run && run.r === r && c >= run.start && c <= run.end;

  const [activeR, activeC] = focus ? [focus.r, focus.c] : [0, 0];

  return (
    <div className={`inline-flex flex-col gap-2 font-mono ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-widest text-muted">{sectionLabel}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted">drag to select a block</span>
      </div>

      <div className="flex flex-col items-center gap-1 rounded-sm border border-border bg-surface px-4 py-3">
        <span className="mb-1 select-none text-[10px] tracking-[0.4em] text-muted">— STAGE —</span>
        <div
          ref={gridRef}
          className="grid gap-y-1"
          style={{ gridTemplateColumns: `2.5em repeat(${cols}, 1.6em)` }}
        >
          {seats.map((seatRow, r) => (
            <div key={r} className="contents">
              <div className="flex items-center text-[10px] text-muted">{rowLabels[r]}</div>
              {seatRow.map((status, c) => {
                if (status === "aisle") {
                  return (
                    <div
                      key={c}
                      aria-hidden
                      className="flex h-6 items-center justify-center text-border"
                      onPointerEnter={() => dragTo({ r, c })}
                    >
                      {" "}
                    </div>
                  );
                }
                const selected = inRun(r, c);
                const isActive = activeR === r && activeC === c;
                return (
                  <button
                    key={c}
                    type="button"
                    data-r={r}
                    data-c={c}
                    disabled={status === "taken"}
                    aria-pressed={selected}
                    aria-label={`${rowLabels[r]} seat ${colLabels[c]}${status === "taken" ? ", taken" : selected ? ", selected" : ", available"}`}
                    tabIndex={isActive ? 0 : -1}
                    className={`flex h-6 w-6 items-center justify-center rounded-[2px] text-xs outline-none transition-colors duration-100 motion-reduce:transition-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-accent ${
                      status === "taken"
                        ? "cursor-not-allowed text-muted/50"
                        : selected
                          ? "bg-accent/[0.16] text-foreground hover:bg-accent/[0.24]"
                          : "text-foreground hover:bg-foreground/[0.08]"
                    }`}
                    onPointerDown={() => startDrag({ r, c })}
                    onPointerEnter={() => dragTo({ r, c })}
                    onFocus={() => setFocus({ r, c })}
                    onKeyDown={(e) => onKeyDown(e, { r, c })}
                  >
                    {status === "taken" ? "×" : selected ? "●" : "○"}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div
        data-count-readout
        aria-live="polite"
        className="rounded-sm border border-border bg-background px-3 py-1.5 text-[11px] tabular-nums text-muted"
      >
        {run ? (
          <>
            <span className="text-foreground">{run.end - run.start + 1}</span>
            {" seats selected — "}
            <span className="text-foreground">
              {rowLabels[run.r]} {colLabels[run.start]}–{colLabels[run.end]}
            </span>
          </>
        ) : (
          "no seats selected — drag across an available block"
        )}
      </div>
    </div>
  );
}
