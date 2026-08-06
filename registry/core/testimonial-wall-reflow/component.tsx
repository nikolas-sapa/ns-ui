"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// TestimonialWallReflow — a testimonial wall where reading one card visibly
// moves the others. Cards are packed into the shortest-column-first masonry
// order every layout pass (own math, not CSS `columns`, because CSS columns
// flow top-to-bottom per column and can't be re-packed on demand). Expanding
// a card's quote via "read more" changes that card's own height; every OTHER
// card then reflows to its new packed slot via a FLIP transform (position is
// pure arithmetic from the packing pass, so the "before" position for the
// FLIP delta is read from a ref of the LAST computed layout, never from a
// live getBoundingClientRect — the packing math is deterministic, so there
// is nothing to race). Only actual position deltas ever animate; a card
// whose slot doesn't move is untouched. No dependency: refs + inline
// transforms, matching the direct-DOM-write convention this registry uses
// for hot-path visual state.
// ---------------------------------------------------------------------------

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  quote: string;
}

const GAP = 16;
const DURATION = 420;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const EXCERPT_LEN = 130;

const DEFAULT_ITEMS: Testimonial[] = [
  {
    id: "t1",
    name: "Priya Nair",
    role: "VP Engineering, Fathom",
    quote:
      "We moved our whole onboarding flow over in a week. The thing that actually convinced the team was how little custom CSS we had to write to make it feel like ours.",
  },
  {
    id: "t2",
    name: "Marcus Ohl",
    role: "Founder, Driftwood",
    quote: "Shipped a working demo before lunch. That never happens.",
  },
  {
    id: "t3",
    name: "Elena Voss",
    role: "Design Lead, Northbound",
    quote:
      "Every component reads its own theme tokens, so our dark mode just worked the day we flipped the switch. No follow-up ticket, which is rare enough that I remember it.",
  },
  {
    id: "t4",
    name: "Tomasz Krol",
    role: "Staff Engineer, Ledgerly",
    quote:
      "The accessibility audit we were dreading came back clean. Focus states, live regions, reduced motion — all handled before we asked.",
  },
  {
    id: "t5",
    name: "Aiyana Redcloud",
    role: "Product, Kestrel",
    quote: "Fast, honest docs, and the demos actually match the shipped behavior.",
  },
  {
    id: "t6",
    name: "Jonah Petrov",
    role: "CTO, Millrace",
    quote:
      "Our team ships marketing pages faster now than we ship internal tools, which is a strange sentence to say out loud but here we are.",
  },
];

function columnsFor(width: number): number {
  if (width < 560) return 1;
  if (width < 900) return 2;
  return 3;
}

type Pos = { x: number; y: number };

function pack(
  order: string[],
  heightOf: (id: string) => number,
  cols: number,
  colW: number
): { pos: Record<string, Pos>; maxH: number } {
  const colH = new Array(cols).fill(0);
  const pos: Record<string, Pos> = {};
  for (const id of order) {
    let target = 0;
    for (let c = 1; c < cols; c++) if (colH[c] < colH[target]) target = c;
    pos[id] = { x: target * (colW + GAP), y: colH[target] };
    colH[target] += heightOf(id) + GAP;
  }
  const maxH = Math.max(0, ...colH.map((h) => Math.max(0, h - GAP)));
  return { pos, maxH };
}

export function TestimonialWallReflow({
  items = DEFAULT_ITEMS,
  className = "",
}: {
  /** the testimonials */
  items?: Testimonial[];
  /** extra classes merged onto the rendered root element */
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const prevPosRef = useRef<Record<string, Pos>>({});
  const reducedRef = useRef(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [containerHeight, setContainerHeight] = useState(0);
  const [colW, setColW] = useState(0);

  const ids = useMemo(() => items.map((t) => t.id), [items]);

  const layout = useCallback(
    (animate: boolean) => {
      const container = containerRef.current;
      if (!container) return;
      const width = container.getBoundingClientRect().width;
      if (width < 4) return;
      const cols = columnsFor(width);
      const w = (width - GAP * (cols - 1)) / cols;
      setColW(w);

      const heightOf = (id: string) => cardRefs.current[id]?.offsetHeight ?? 0;
      const { pos, maxH } = pack(ids, heightOf, cols, w);
      const prev = prevPosRef.current;

      for (const id of ids) {
        const el = cardRefs.current[id];
        if (!el) continue;
        const after = pos[id]!;
        const before = prev[id];
        el.style.left = `${after.x}px`;
        el.style.top = `${after.y}px`;
        if (
          animate &&
          !reducedRef.current &&
          before &&
          (Math.round(before.x) !== Math.round(after.x) ||
            Math.round(before.y) !== Math.round(after.y))
        ) {
          const dx = before.x - after.x;
          const dy = before.y - after.y;
          el.style.transition = "none";
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          // force layout so the "before" transform actually paints before
          // the transition below is armed
          void el.getBoundingClientRect();
          el.style.transition = `transform ${DURATION}ms ${EASE}`;
          el.style.transform = "translate(0, 0)";
        } else {
          el.style.transition = "";
          el.style.transform = "";
        }
      }

      prevPosRef.current = pos;
      setContainerHeight(maxH);
    },
    [ids]
  );

  useLayoutEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    layout(false);
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => layout(false));
    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mountedRef = useRef(false);
  useLayoutEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    // re-pack on every expand/collapse toggle, animated: this is the reflow
    layout(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={{ height: containerHeight || undefined }}
    >
      {items.map((t) => {
        const isLong = t.quote.length > EXCERPT_LEN + 20;
        const isExpanded = !!expanded[t.id];
        const excerpt = isLong && !isExpanded ? `${t.quote.slice(0, EXCERPT_LEN).trimEnd()}…` : t.quote;
        return (
          <figure
            key={t.id}
            ref={(el) => {
              cardRefs.current[t.id] = el;
            }}
            data-expanded={isExpanded}
            className="absolute rounded-md border border-border bg-surface p-5 will-change-transform"
            style={{ width: colW || undefined }}
          >
            <blockquote className="m-0 text-sm leading-relaxed text-foreground">{excerpt}</blockquote>
            {isLong && (
              <button
                type="button"
                data-expand-toggle
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Read less" : "Read more"} of ${t.name}'s testimonial`}
                onClick={() => toggle(t.id)}
                className="mt-2 rounded-sm font-mono text-xs text-ns-muted underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
              >
                {isExpanded ? "read less" : "read more"}
              </button>
            )}
            <figcaption className="mt-4 flex items-center gap-2.5 border-t border-border pt-3">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background font-mono text-[10px] text-ns-muted"
              >
                {t.name
                  .split(/\s+/)
                  .map((w) => w[0] ?? "")
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-foreground">{t.name}</span>
                <span className="block truncate text-xs text-ns-muted">{t.role}</span>
              </span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
