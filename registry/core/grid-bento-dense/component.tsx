"use client";

import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type BentoSize = "1x1" | "2x1" | "1x2";

export interface BentoCell {
  /** Stable id — also the roving-tabindex key and the FLIP measurement key. */
  id: string;
  title: string;
  meta?: string;
  body?: ReactNode;
  /** Resting footprint. Ignored while this cell is featured (always 2x2). */
  size?: BentoSize;
}

export interface BentoGridProps {
  cells: BentoCell[];
  cols?: number;
  defaultFeaturedId?: string;
  className?: string;
}

const SPAN: Record<BentoSize, { c: number; r: number }> = {
  "1x1": { c: 1, r: 1 },
  "2x1": { c: 2, r: 1 },
  "1x2": { c: 1, r: 2 },
};

const ROW_PX = 108;

function spanFor(cell: BentoCell, isFeatured: boolean, cols: number) {
  if (isFeatured) return { c: Math.min(2, cols), r: 2 };
  return SPAN[cell.size ?? "1x1"];
}

// Worst-case row count across every possible featured cell — computed once
// from the cell list, not the live state — so the grid's own box height
// never jumps as different cells get promoted. Dense packing may leave a
// little trailing slack in the non-worst states; it never overflows.
function computeRows(cells: BentoCell[], cols: number): number {
  let worst = 0;
  for (const candidate of cells) {
    let units = 0;
    for (const cell of cells) {
      const { c, r } = spanFor(cell, cell.id === candidate.id, cols);
      units += c * r;
    }
    worst = Math.max(worst, units);
  }
  return Math.max(1, Math.ceil(worst / cols));
}

/**
 * A bento grid where cells reflow for real: activating one promotes it to a
 * 2x2 slot and every other cell re-packs around it via CSS `grid-auto-flow:
 * dense` — the browser's own layout engine, not a fixed grid-template-areas
 * arrangement. The reflow is FLIP-animated (translate only, size changes
 * instantly) so it reads as tiles sliding into new slots rather than
 * teleporting or smearing under a scale transform. Arrow keys move focus
 * spatially between tiles by their actual on-screen geometry, not DOM order.
 */
export function BentoGrid({ cells, cols = 4, defaultFeaturedId, className = "" }: BentoGridProps) {
  const initial = defaultFeaturedId ?? cells[0]?.id ?? "";
  const [featuredId, setFeaturedId] = useState(initial);
  const [activeId, setActiveId] = useState(initial);
  const [announce, setAnnounce] = useState("");
  const refs = useRef(new Map<string, HTMLDivElement>());
  const pendingFirst = useRef<Map<string, DOMRect> | null>(null);

  const rows = useMemo(() => computeRows(cells, cols), [cells, cols]);

  const activate = (id: string) => {
    setActiveId(id);
    if (id === featuredId) return;
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      const first = new Map<string, DOMRect>();
      refs.current.forEach((el, key) => first.set(key, el.getBoundingClientRect()));
      pendingFirst.current = first;
    }
    setFeaturedId(id);
    const cell = cells.find((c) => c.id === id);
    if (cell) setAnnounce(`${cell.title} featured`);
  };

  // FLIP: positions were captured synchronously before the state write above;
  // once the new layout has painted, invert each moved cell back to its old
  // position with transitions off, then release it into a transform
  // transition back to zero. Size changes (1x1 -> 2x2) happen instantly —
  // scaling a bordered, rounded card is what smears its border and text.
  useLayoutEffect(() => {
    const first = pendingFirst.current;
    pendingFirst.current = null;
    if (!first) return;
    refs.current.forEach((el, key) => {
      const from = first.get(key);
      if (!from) return;
      const to = el.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (!dx && !dy) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      void el.getBoundingClientRect(); // force reflow before releasing
      requestAnimationFrame(() => {
        el.style.transition = "transform 380ms cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "";
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuredId]);

  // Spatial nav: candidates are filtered to the pressed half-plane by their
  // actual rendered centre, then scored by distance along the pressed axis
  // plus double the perpendicular drift — reading order plays no part.
  const move = (dir: "up" | "down" | "left" | "right") => {
    const cur = refs.current.get(activeId)?.getBoundingClientRect();
    if (!cur) return;
    const cx = cur.left + cur.width / 2;
    const cy = cur.top + cur.height / 2;
    let bestId: string | null = null;
    let bestScore = Infinity;
    refs.current.forEach((el, id) => {
      if (id === activeId) return;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2 - cx;
      const y = r.top + r.height / 2 - cy;
      let primary: number;
      let secondary: number;
      if (dir === "right") {
        if (x <= 1) return;
        primary = x;
        secondary = Math.abs(y);
      } else if (dir === "left") {
        if (x >= -1) return;
        primary = -x;
        secondary = Math.abs(y);
      } else if (dir === "down") {
        if (y <= 1) return;
        primary = y;
        secondary = Math.abs(x);
      } else {
        if (y >= -1) return;
        primary = -y;
        secondary = Math.abs(x);
      }
      const score = primary + secondary * 2;
      if (score < bestScore) {
        bestScore = score;
        bestId = id;
      }
    });
    if (bestId) {
      setActiveId(bestId);
      refs.current.get(bestId)?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, id: string) => {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        move("right");
        break;
      case "ArrowLeft":
        e.preventDefault();
        move("left");
        break;
      case "ArrowDown":
        e.preventDefault();
        move("down");
        break;
      case "ArrowUp":
        e.preventDefault();
        move("up");
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        activate(id);
        break;
      default:
        break;
    }
  };

  return (
    <div className="w-full">
      <div
        role="group"
        aria-label="Bento grid. Arrow keys move between tiles, Enter or Space features one."
        className={`grid gap-3 ${className}`}
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, ${ROW_PX}px)`,
          gridAutoFlow: "dense",
        }}
      >
        {cells.map((cell) => {
          const isFeatured = cell.id === featuredId;
          const { c, r } = spanFor(cell, isFeatured, cols);
          return (
            <div
              key={cell.id}
              ref={(el) => {
                if (el) refs.current.set(cell.id, el);
                else refs.current.delete(cell.id);
              }}
              role="button"
              tabIndex={cell.id === activeId ? 0 : -1}
              aria-pressed={isFeatured}
              aria-label={cell.title}
              data-cell-id={cell.id}
              data-featured={String(isFeatured)}
              onClick={() => activate(cell.id)}
              onKeyDown={(e) => onKeyDown(e, cell.id)}
              onFocus={() => setActiveId(cell.id)}
              className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-md border border-border bg-surface p-4 text-left transition-colors duration-150 hover:border-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              style={{ gridColumn: `span ${c}`, gridRow: `span ${r}` }}
            >
              {isFeatured && (
                <span aria-hidden className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-accent" />
              )}
              <div>
                {cell.meta && (
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">{cell.meta}</p>
                )}
                <h3 className={`font-medium text-foreground ${isFeatured ? "text-base" : "text-sm"}`}>
                  {cell.title}
                </h3>
              </div>
              {cell.body && <div className="mt-2 flex-1 text-sm text-muted">{cell.body}</div>}
              <span
                aria-hidden
                className="pointer-events-none mt-2 block text-right font-mono text-[10px] uppercase tracking-widest text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                {isFeatured ? "featured" : "feature this"}
              </span>
            </div>
          );
        })}
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
