"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SheetAsciiRange — a spreadsheet-style rectangular range select. Dragging
// (or Shift+Arrow from a roving-tabindex active cell) grows a rectangle of
// cells; the rectangle's own perimeter is drawn from real box-drawing glyphs
// (┌─┐│└┘) positioned on the seams between cells, and a live ASCII status
// bar prints the aggregate (n / sum / mean / min / max) of whatever is
// currently inside it. The aggregate recomputes on every cell the rectangle
// gains or loses, whether that came from a pointer drag or a keystroke — the
// mechanic is the rectangle-of-cells selection itself, not a cell's visual
// style (table-heat-shimmer is a fixed table whose HOT rows shimmer; nothing
// here is selectable). No canvas: every glyph is a real DOM span positioned
// on the cell grid, colored from tokens via Tailwind classes only.
// ---------------------------------------------------------------------------

type Cell = { r: number; c: number };

export interface SheetAsciiRangeProps {
  /** rows x cols numeric grid */
  data?: number[][];
  rowLabels?: string[];
  colLabels?: string[];
  /** unit suffix printed after aggregate numbers, e.g. "units" */
  unit?: string;
  title?: string;
  className?: string;
}

const DEFAULT_DATA: number[][] = [
  [42, 58, 61, 33, 70, 45, 52, 39],
  [55, 63, 47, 71, 38, 60, 44, 57],
  [31, 49, 66, 52, 59, 41, 68, 36],
  [64, 40, 53, 62, 46, 73, 35, 50],
  [48, 57, 34, 65, 51, 43, 69, 32],
  [37, 61, 56, 48, 67, 54, 42, 60],
];

const DEFAULT_ROW_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DEFAULT_COL_LABELS = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function SheetAsciiRange({
  data = DEFAULT_DATA,
  rowLabels = DEFAULT_ROW_LABELS,
  colLabels = DEFAULT_COL_LABELS,
  unit = "units",
  title = "Shipment log",
  className = "",
}: SheetAsciiRangeProps) {
  const rows = data.length;
  const cols = data[0]?.length ?? 0;

  const [anchor, setAnchor] = useState<Cell | null>(null);
  const [focus, setFocus] = useState<Cell>({ r: 0, c: 0 });
  const draggingRef = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const rect = useMemo(() => {
    if (!anchor) return null;
    return {
      top: Math.min(anchor.r, focus.r),
      bottom: Math.max(anchor.r, focus.r),
      left: Math.min(anchor.c, focus.c),
      right: Math.max(anchor.c, focus.c),
    };
  }, [anchor, focus]);

  const stats = useMemo(() => {
    if (!rect) return { n: 0, sum: 0, mean: 0, min: 0, max: 0 };
    let n = 0;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (let r = rect.top; r <= rect.bottom; r++) {
      for (let c = rect.left; c <= rect.right; c++) {
        const v = data[r]?.[c] ?? 0;
        n++;
        sum += v;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    return { n, sum, mean: n ? sum / n : 0, min: n ? min : 0, max: n ? max : 0 };
  }, [rect, data]);

  const inRect = useCallback(
    (r: number, c: number) => !!rect && r >= rect.top && r <= rect.bottom && c >= rect.left && c <= rect.right,
    [rect]
  );

  const startDrag = (cell: Cell) => {
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

  const focusCellButton = (r: number, c: number) => {
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-r="${r}"][data-c="${c}"]`)?.focus();
  };

  const moveActive = (dr: number, dc: number, extend: boolean) => {
    const nr = clamp(focus.r + dr, 0, rows - 1);
    const nc = clamp(focus.c + dc, 0, cols - 1);
    if (extend) {
      if (!anchor) setAnchor(focus);
      setFocus({ r: nr, c: nc });
    } else {
      setAnchor({ r: nr, c: nc });
      setFocus({ r: nr, c: nc });
    }
    focusCellButton(nr, nc);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const delta = map[e.key];
    if (!delta) return;
    e.preventDefault();
    moveActive(delta[0], delta[1], e.shiftKey);
  };

  return (
    <div className={`inline-flex flex-col gap-2 font-mono ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-widest text-muted">{title}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted">drag or shift+arrow to select</span>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={`${title} cell grid`}
        className="relative inline-grid select-none rounded-sm border border-border bg-surface p-2"
        style={{
          gridTemplateColumns: `3.5em repeat(${cols}, 3em)`,
        }}
      >
        <div />
        {colLabels.map((label) => (
          <div key={label} className="px-1 py-1 text-center text-[10px] text-muted">
            {label}
          </div>
        ))}

        {rowLabels.map((rowLabel, r) => (
          <div key={rowLabel} className="contents">
            <div className="flex items-center px-1 text-[10px] text-muted">{rowLabel}</div>
            {Array.from({ length: cols }, (_, c) => {
              const value = data[r]?.[c] ?? 0;
              const selected = inRect(r, c);
              const isActive = focus.r === r && focus.c === c;
              const isTop = selected && r === rect!.top;
              const isBottom = selected && r === rect!.bottom;
              const isLeft = selected && c === rect!.left;
              const isRight = selected && c === rect!.right;

              let corner: string | null = null;
              if (isTop && isLeft) corner = "corner-tl";
              else if (isTop && isRight) corner = "corner-tr";
              else if (isBottom && isLeft) corner = "corner-bl";
              else if (isBottom && isRight) corner = "corner-br";

              const glyph =
                corner === "corner-tl"
                  ? "┌"
                  : corner === "corner-tr"
                    ? "┐"
                    : corner === "corner-bl"
                      ? "└"
                      : corner === "corner-br"
                        ? "┘"
                        : isTop || isBottom
                          ? "─"
                          : isLeft || isRight
                            ? "│"
                            : null;

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  data-r={r}
                  data-c={c}
                  role="gridcell"
                  aria-selected={selected}
                  aria-label={`${rowLabel} ${colLabels[c]}: ${fmt(value)} ${unit}`}
                  tabIndex={isActive ? 0 : -1}
                  className={`relative flex h-8 items-center justify-end px-1.5 text-xs tabular-nums text-foreground outline-none transition-colors duration-100 motion-reduce:transition-none hover:bg-foreground/[0.06] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                    selected ? "bg-accent/[0.09]" : ""
                  }`}
                  onPointerDown={() => startDrag({ r, c })}
                  onPointerEnter={() => dragTo({ r, c })}
                  onFocus={() => setFocus({ r, c })}
                  onKeyDown={onKeyDown}
                >
                  {fmt(value)}
                  {glyph && (
                    <span
                      aria-hidden
                      data-glyph={corner ?? (isTop ? "top" : isBottom ? "bottom" : isLeft ? "left" : "right")}
                      className={`absolute select-none text-[11px] leading-none text-foreground ${
                        corner
                          ? corner === "corner-tl"
                            ? "-left-px -top-px -translate-x-1/2 -translate-y-1/2"
                            : corner === "corner-tr"
                              ? "-right-px -top-px translate-x-1/2 -translate-y-1/2"
                              : corner === "corner-bl"
                                ? "-bottom-px -left-px -translate-x-1/2 translate-y-1/2"
                                : "-bottom-px -right-px translate-x-1/2 translate-y-1/2"
                          : isTop
                            ? "inset-x-0 -top-px -translate-y-1/2 text-center"
                            : isBottom
                              ? "inset-x-0 -bottom-px translate-y-1/2 text-center"
                              : isLeft
                                ? "inset-y-0 -left-px -translate-x-1/2 flex items-center"
                                : "inset-y-0 -right-px translate-x-1/2 flex items-center"
                      }`}
                    >
                      {glyph}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div
        data-status-bar
        aria-live="polite"
        className="rounded-sm border border-border bg-background px-3 py-1.5 text-[11px] tabular-nums text-muted"
      >
        {stats.n > 0 ? (
          <>
            <span className="text-foreground">n={stats.n}</span>
            {"  Σ="}
            <span className="text-foreground">{fmt(stats.sum)}</span>
            {"  x̄="}
            <span className="text-foreground">{fmt(stats.mean)}</span>
            {"  min="}
            <span className="text-foreground">{fmt(stats.min)}</span>
            {"  max="}
            <span className="text-foreground">{fmt(stats.max)}</span>
            {` ${unit}`}
          </>
        ) : (
          "n=0 — click a cell or drag a range"
        )}
      </div>
    </div>
  );
}
