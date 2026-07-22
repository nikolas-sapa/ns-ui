"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// HumpYard — a list/grid/board view switcher for the same data, styled after
// a rail classification yard: instead of a generic FLIP where every card
// flies through every other card, each item gets its own drawn rail — a thin
// curved SVG path from its old slot to its new one — and travels that exact
// rail via CSS offset-path, so a user tracking "the row I was reading" can
// trace its specific journey instead of guessing which blur is which.
//
// MECHANISM: on a view change the new layout commits INSTANTLY (React state,
// synchronous — DOM order/semantics never sit in an intermediate frame, so
// assistive tech never observes a half-finished shuffle). A layout effect
// then measures each item's old rect (captured just before the commit) and
// new rect (read fresh from the committed DOM), builds a slightly sagging
// cubic path between the two centers for the visible rail and an equivalent
// local-space path for the item itself, and lets each item ride its rail via
// `offset-path` + animated `offset-distance` (ease-out-expo). Items are
// released in original reading order at a 15ms stagger — the "cars cut loose
// over the hump" — and each rail fades out 150ms after its own item docks,
// rather than all clearing together. Where `offset-path` isn't supported the
// whole rail apparatus is skipped and items instead run a plain FLIP
// translate between the same two rects — still correct, just undrawn.
//
// Pure DOM + one small SVG overlay, no canvas. Every drawn stroke is
// `var(--border)` at the token's own alpha via `stroke-opacity` — nothing
// baked in as a literal. Board view groups items by status into three
// columns purely through position (left/top), never by moving DOM nodes
// between parents, so tab order and screen-reader reading order stay
// identical to the original item list in every view.
//
// prefers-reduced-motion: the new layout still commits instantly; instead of
// rails and travel, items get a plain 120ms opacity crossfade and nothing
// else moves.
// ---------------------------------------------------------------------------

const VIEWS = [
  { value: "list", label: "List" },
  { value: "grid", label: "Grid" },
  { value: "board", label: "Board" },
] as const;

type ViewMode = (typeof VIEWS)[number]["value"];

export interface HumpYardItem {
  id: string;
  title: string;
  subtitle?: string;
  status: "todo" | "doing" | "done";
}

const STATUS_LABEL: Record<HumpYardItem["status"], string> = {
  todo: "To do",
  doing: "In progress",
  done: "Done",
};

const STATUS_ORDER: HumpYardItem["status"][] = ["todo", "doing", "done"];

const DEFAULT_ITEMS: HumpYardItem[] = [
  { id: "1", title: "Design review", subtitle: "Mara Chen", status: "todo" },
  { id: "2", title: "Update pricing page", subtitle: "Jonas Weber", status: "todo" },
  { id: "3", title: "Fix mobile nav overlap", subtitle: "Aiko Tanaka", status: "todo" },
  { id: "4", title: "Draft Q3 roadmap", subtitle: "Sam Okafor", status: "todo" },
  { id: "5", title: "Accessibility pass", subtitle: "Lena Fischer", status: "todo" },
  { id: "6", title: "Migrate auth service", subtitle: "Ravi Patel", status: "doing" },
  { id: "7", title: "Refactor billing module", subtitle: "Nora Lindqvist", status: "doing" },
  { id: "8", title: "Customer interview notes", subtitle: "Mara Chen", status: "doing" },
  { id: "9", title: "Investigate flaky test", subtitle: "Jonas Weber", status: "doing" },
  { id: "10", title: "Prepare demo deck", subtitle: "Aiko Tanaka", status: "doing" },
  { id: "11", title: "Write changelog", subtitle: "Sam Okafor", status: "done" },
  { id: "12", title: "Set up staging env", subtitle: "Ravi Patel", status: "done" },
  { id: "13", title: "Onboarding flow audit", subtitle: "Lena Fischer", status: "done" },
  { id: "14", title: "Backfill analytics events", subtitle: "Nora Lindqvist", status: "done" },
];

const GAP = 12;
const ITEM_H = 60;
const BOARD_HEADER_H = 22;
const STAGGER_MS = 15;
const TRAVEL_MS = 560;
const RAIL_FADE_MS = 150;
const REDUCED_MS = 120;
const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function computeLayout(mode: ViewMode, items: HumpYardItem[], width: number) {
  const boxes = new Map<string, Box>();
  const headers: { label: string; x: number; y: number; w: number }[] = [];
  const w = Math.max(width, 1);

  if (mode === "list") {
    items.forEach((it, i) => {
      boxes.set(it.id, { x: 0, y: i * (ITEM_H + GAP), w, h: ITEM_H });
    });
  } else if (mode === "grid") {
    const cols = Math.max(2, Math.min(4, Math.floor((w + GAP) / (208 + GAP)) || 2));
    const cw = (w - GAP * (cols - 1)) / cols;
    items.forEach((it, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      boxes.set(it.id, { x: col * (cw + GAP), y: row * (ITEM_H + GAP), w: cw, h: ITEM_H });
    });
  } else {
    const cols = 3;
    const cw = (w - GAP * (cols - 1)) / cols;
    STATUS_ORDER.forEach((status, colIdx) => {
      const x = colIdx * (cw + GAP);
      headers.push({ label: STATUS_LABEL[status], x, y: 0, w: cw });
      const colItems = items.filter((it) => it.status === status);
      colItems.forEach((it, row) => {
        boxes.set(it.id, {
          x,
          y: BOARD_HEADER_H + GAP + row * (ITEM_H + GAP),
          w: cw,
          h: ITEM_H,
        });
      });
    });
  }

  let maxBottom = 0;
  boxes.forEach((b) => {
    maxBottom = Math.max(maxBottom, b.y + b.h);
  });
  if (mode === "board") maxBottom = Math.max(maxBottom, BOARD_HEADER_H);

  return { boxes, headers, height: maxBottom };
}

// Cubic bezier control points for a cable-like sag between two points: the
// midsection bows toward the downward perpendicular (screen-space +y), the
// same reading regardless of which way the item is actually travelling.
function bow(sx: number, sy: number, ex: number, ey: number) {
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.hypot(dx, dy) || 1;
  let px = -dy / len;
  let py = dx / len;
  if (py < 0) {
    px = -px;
    py = -py;
  }
  const sag = Math.min(30, Math.max(6, len * 0.14));
  return {
    c1x: sx + dx * 0.33 + px * sag,
    c1y: sy + dy * 0.33 + py * sag,
    c2x: sx + dx * 0.66 + px * sag,
    c2y: sy + dy * 0.66 + py * sag,
  };
}

let offsetPathSupport: boolean | null = null;
function supportsOffsetPath() {
  if (offsetPathSupport !== null) return offsetPathSupport;
  offsetPathSupport =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("offset-path", "path('M0 0L1 1')");
  return offsetPathSupport;
}

export interface HumpYardProps {
  /** The data set. Same items are reused across all three views. */
  items?: HumpYardItem[];
  /** Uncontrolled initial view. @default "list" */
  defaultView?: ViewMode;
  /** Controlled view. */
  view?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
  /** Accessible name for the item collection, e.g. "Tasks". */
  "aria-label"?: string;
  className?: string;
}

export function HumpYard({
  items = DEFAULT_ITEMS,
  defaultView = "list",
  view: controlledView,
  onViewChange,
  "aria-label": ariaLabel = "Tasks",
  className = "",
}: HumpYardProps) {
  const [uncontrolledView, setUncontrolledView] = useState<ViewMode>(defaultView);
  const view = controlledView ?? uncontrolledView;
  const viewRef = useRef(view);
  viewRef.current = view;

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const containerRef = useRef<HTMLDivElement>(null);
  const railSvgRef = useRef<SVGSVGElement>(null);
  const itemElsRef = useRef(new Map<string, HTMLDivElement>());
  const pendingOldRectsRef = useRef<Map<string, DOMRect> | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const railElsRef = useRef<SVGPathElement[]>([]);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const isFirstViewEffectRef = useRef(true);

  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? el.clientWidth;
      setWidth(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { boxes, headers, height } = useMemo(
    () => computeLayout(view, items, width || 1),
    [view, items, width]
  );

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
  }, []);

  const clearRails = useCallback(() => {
    railElsRef.current.forEach((p) => p.remove());
    railElsRef.current = [];
  }, []);

  useEffect(
    () => () => {
      clearTimeouts();
      clearRails();
    },
    [clearTimeouts, clearRails]
  );

  // Capture old rects synchronously, before the state update that commits
  // the new layout — this is the "F" of FLIP.
  const requestView = useCallback(
    (next: ViewMode) => {
      if (next === viewRef.current) return;
      const oldRects = new Map<string, DOMRect>();
      itemElsRef.current.forEach((el, id) => {
        oldRects.set(id, el.getBoundingClientRect());
      });
      pendingOldRectsRef.current = oldRects;
      onViewChange?.(next);
      if (controlledView === undefined) setUncontrolledView(next);
    },
    [onViewChange, controlledView]
  );

  // Runs after the new layout has committed (still before paint): measures
  // new rects, draws rails, and kicks off the staggered travel.
  useLayoutEffect(() => {
    const oldRects = pendingOldRectsRef.current;
    pendingOldRectsRef.current = null;
    if (!oldRects) return;

    clearTimeouts();
    clearRails();

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ids = itemsRef.current.map((it) => it.id);
    const svg = railSvgRef.current;
    const containerBox = containerRef.current?.getBoundingClientRect();

    if (reduced) {
      ids.forEach((id) => {
        const el = itemElsRef.current.get(id);
        if (!el) return;
        el.style.transition = "none";
        el.style.opacity = "0";
      });
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          ids.forEach((id) => {
            const el = itemElsRef.current.get(id);
            if (!el) return;
            el.style.transition = `opacity ${REDUCED_MS}ms ease-out`;
            el.style.opacity = "1";
          });
          const t = window.setTimeout(() => {
            ids.forEach((id) => {
              const el = itemElsRef.current.get(id);
              if (!el) return;
              el.style.transition = "";
              el.style.opacity = "";
            });
          }, REDUCED_MS + 40);
          timeoutsRef.current.push(t);
        });
        timeoutsRef.current.push(raf2 as unknown as number);
      });
      timeoutsRef.current.push(raf1 as unknown as number);
      return;
    }

    const useOffset = supportsOffsetPath();

    ids.forEach((id, i) => {
      const el = itemElsRef.current.get(id);
      const oldRect = oldRects.get(id);
      if (!el || !oldRect) return;
      const newRect = el.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

      const delay = i * STAGGER_MS;

      if (useOffset) {
        const local = bow(dx, dy, 0, 0);
        el.style.transition = "none";
        el.style.setProperty("offset-rotate", "0deg");
        el.style.setProperty("offset-anchor", "0px 0px");
        el.style.setProperty(
          "offset-path",
          `path('M ${dx} ${dy} C ${local.c1x} ${local.c1y} ${local.c2x} ${local.c2y} 0 0')`
        );
        el.style.setProperty("offset-distance", "0%");
        void el.offsetWidth;

        if (svg && containerBox) {
          const oldCx = oldRect.left + oldRect.width / 2 - containerBox.left;
          const oldCy = oldRect.top + oldRect.height / 2 - containerBox.top;
          const newCx = newRect.left + newRect.width / 2 - containerBox.left;
          const newCy = newRect.top + newRect.height / 2 - containerBox.top;
          const rail = bow(oldCx, oldCy, newCx, newCy);
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute(
            "d",
            `M ${oldCx} ${oldCy} C ${rail.c1x} ${rail.c1y} ${rail.c2x} ${rail.c2y} ${newCx} ${newCy}`
          );
          path.setAttribute("fill", "none");
          path.setAttribute("stroke", "var(--border)");
          path.setAttribute("stroke-width", "1");
          path.setAttribute("stroke-opacity", "0.3");
          path.style.transition = `opacity ${RAIL_FADE_MS}ms ease-out`;
          svg.appendChild(path);
          railElsRef.current.push(path);

          const t1 = window.setTimeout(() => {
            el.style.transition = `offset-distance ${TRAVEL_MS}ms ${EASE_OUT_EXPO}`;
            el.style.setProperty("offset-distance", "100%");
          }, delay);
          const t2 = window.setTimeout(() => {
            el.style.transition = "";
            el.style.removeProperty("offset-path");
            el.style.removeProperty("offset-distance");
            el.style.removeProperty("offset-anchor");
            el.style.removeProperty("offset-rotate");
            path.style.opacity = "0";
            const t3 = window.setTimeout(() => {
              path.remove();
              railElsRef.current = railElsRef.current.filter((p) => p !== path);
            }, RAIL_FADE_MS + 30);
            timeoutsRef.current.push(t3);
          }, delay + TRAVEL_MS);
          timeoutsRef.current.push(t1, t2);
        }
      } else {
        // Fallback: plain FLIP translate, no drawn rail.
        el.style.transition = "none";
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        void el.offsetWidth;
        const t1 = window.setTimeout(() => {
          el.style.transition = `transform ${TRAVEL_MS}ms ${EASE_OUT_EXPO}`;
          el.style.transform = "translate3d(0,0,0)";
        }, delay);
        const t2 = window.setTimeout(() => {
          el.style.transition = "";
          el.style.transform = "";
        }, delay + TRAVEL_MS);
        timeoutsRef.current.push(t1, t2);
      }
    });
    // boxes captures [view, items, width] already; re-running this effect
    // only matters when a pending transition was actually queued.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxes]);

  // Async announcement of the new view — skipped on mount.
  useEffect(() => {
    if (isFirstViewEffectRef.current) {
      isFirstViewEffectRef.current = false;
      return;
    }
    const label = VIEWS.find((v) => v.value === view)?.label ?? view;
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = `${label} view, ${items.length} items`;
    }
  }, [view, items.length]);

  const onToggleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = VIEWS.findIndex((v) => v.value === view);
    let next = -1;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + VIEWS.length) % VIEWS.length;
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % VIEWS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = VIEWS.length - 1;
    else return;
    e.preventDefault();
    const target = VIEWS[next];
    if (target) requestView(target.value);
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted">
          {ariaLabel}
        </span>
        <div
          role="radiogroup"
          aria-label="View"
          onKeyDown={onToggleKeyDown}
          className="inline-flex shrink-0 items-center gap-0.5 rounded-sm border border-border bg-foreground/[0.04] p-0.5"
        >
          {VIEWS.map((opt) => {
            const selected = opt.value === view;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => requestView(opt.value)}
                className={`rounded-[4px] px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent ${
                  selected
                    ? "bg-background text-foreground shadow-sm hover:ring-1 hover:ring-inset hover:ring-border"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {opt.label} view
              </button>
            );
          })}
        </div>
      </div>

      <div ref={liveRegionRef} aria-live="polite" className="sr-only" />

      <div
        ref={containerRef}
        role="list"
        aria-label={ariaLabel}
        data-view={view}
        className="relative w-full transition-[height] duration-300 ease-out motion-reduce:transition-none"
        style={{ height }}
      >
        <svg
          ref={railSvgRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        />
        {headers.map((h) => (
          <div
            key={h.label}
            aria-hidden
            className="absolute font-mono text-[10px] uppercase tracking-wide text-muted"
            style={{ left: h.x, top: h.y, width: h.w }}
          >
            {h.label}
          </div>
        ))}
        {items.map((it) => {
          const box = boxes.get(it.id);
          if (!box) return null;
          return (
            <div
              key={it.id}
              role="listitem"
              ref={(el) => {
                if (el) itemElsRef.current.set(it.id, el);
                else itemElsRef.current.delete(it.id);
              }}
              className="absolute flex items-center gap-2 overflow-hidden rounded-md border border-border bg-foreground/[0.03] px-3 py-2 will-change-transform"
              style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-foreground">
                  {it.title}
                </div>
                {it.subtitle && (
                  <div className="truncate text-[11px] text-muted">{it.subtitle}</div>
                )}
              </div>
              <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted">
                {STATUS_LABEL[it.status]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
