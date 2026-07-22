"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

// ---------------------------------------------------------------------------
// DrawTubeBreadcrumb — breadcrumbs that collapse like the draw tubes of a
// spyglass. When the trail outgrows the container, middle crumbs telescope
// INTO their neighbor: each shrinks to a 2px sliver (its own right --border
// edge is what remains visible) while its label slides and fades away
// underneath, staggered 40ms per level. This replaces the information-
// destroying "…" of a classic collapsed breadcrumb with an honest stack of
// slivers — you can still SEE how many levels are hiding, and every one of
// them is still a real, focusable, screen-reader-visible link; nothing is
// ever display:none.
//
// Root and current page never collapse. When the trail overflows, the
// crumb closest to the current page collapses first (innermost-middle
// first), the rest following outward toward the root as needed — a real
// telescope closes tip-first. Hovering or focusing anywhere in the trail
// (via :hover / :focus-within — no JS state needed for this part) extends
// every collapsed crumb back out with a staggered pull-out: root-adjacent
// crumbs lead, later (deeper) ones follow a beat after and land with a
// touch more spring overshoot, like the last snap of an antenna extending.
// Collapse always eases with ease-out-expo; expansion always eases with a
// per-segment overshoot cubic-bezier, so the two directions read distinctly
// even though it's the same CSS custom properties driving both.
//
// A hidden aria-hidden clone of the same markup measures each crumb's true
// natural width via ResizeObserver (so collapsed crumbs — locked to 2px in
// the real DOM — still have a real target width to expand back toward), and
// a second ResizeObserver watches the visible container for the width
// actually available. Nothing here is display:none or aria-hidden on the
// real trail: nav[aria-label="Breadcrumb"] > ol, every non-current crumb a
// real <a>. prefers-reduced-motion drops every transition; the resting and
// expanded states themselves are unchanged, just not eased into.
// ---------------------------------------------------------------------------

export interface DrawTubeCrumb {
  /** stable identity, used for the React key and onNavigate */
  id: string;
  label: string;
  /** href for the underlying <a>; omit only if this crumb never navigates */
  href?: string;
}

export interface DrawTubeBreadcrumbProps {
  /** ordered root -> current; the LAST item renders as the current page (non-link) */
  items: DrawTubeCrumb[];
  /** called on click of any non-current crumb; when provided the click's default navigation is prevented */
  onNavigate?: (id: string, event: ReactMouseEvent<HTMLAnchorElement>) => void;
  className?: string;
}

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

const COLLAPSED_WIDTH = 2; // px — exactly the visible border sliver
const STAGGER_MS = 40;
const COLLAPSE_MS = 340;
const EXPAND_MS = 380;
const COLLAPSE_EASE = "cubic-bezier(0.19,1,0.22,1)"; // ease-out-expo

function computeCollapsed(widths: number[], available: number): Set<number> {
  const n = widths.length;
  if (n <= 2 || available <= 0) return new Set();
  if (widths.some((w) => w <= 0)) return new Set(); // not measured yet — never collapse blind
  let total = widths.reduce((a, b) => a + b, 0);
  if (total <= available) return new Set();
  const collapsed = new Set<number>();
  // innermost-middle first: start adjacent to the current page (n-2) and
  // work back toward the root (1), never touching 0 or n-1.
  for (let i = n - 2; i >= 1 && total > available; i--) {
    total -= widths[i] - COLLAPSED_WIDTH;
    collapsed.add(i);
  }
  return collapsed;
}

function CrumbContent({ label }: { label: string }) {
  return <span className="dt-slide-inner">{label}</span>;
}

export function DrawTubeBreadcrumb({ items, onNavigate, className }: DrawTubeBreadcrumbProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hiddenRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [itemWidths, setItemWidths] = useState<number[]>(() => items.map(() => 0));

  useEffect(() => {
    setItemWidths((prev) => (prev.length === items.length ? prev : items.map(() => 0)));
  }, [items.length]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        const w = entry.contentRect.width;
        const idxAttr = target.dataset.dtIdx;
        if (idxAttr !== undefined) {
          const idx = Number(idxAttr);
          setItemWidths((prev) => {
            if (idx >= prev.length || Math.abs((prev[idx] ?? 0) - w) < 0.5) return prev;
            const next = prev.slice();
            next[idx] = w;
            return next;
          });
        } else {
          setAvailableWidth((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
        }
      }
    });

    ro.observe(wrapper);
    for (const el of hiddenRefs.current) if (el) ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const collapsed = useMemo(() => computeCollapsed(itemWidths, availableWidth), [itemWidths, availableWidth]);

  const collapsedOrder = useMemo(() => Array.from(collapsed).sort((a, b) => a - b), [collapsed]);

  const handleClick = (item: DrawTubeCrumb) => (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (onNavigate) {
      event.preventDefault();
      onNavigate(item.id, event);
    }
  };

  return (
    <div ref={wrapperRef} className={["dt-root", className].filter(Boolean).join(" ")}>
      <style>{`
.dt-root .dt-ol{list-style:none;margin:0;padding:0;gap:0}
.dt-root .dt-li{
  overflow:hidden;box-sizing:border-box;flex:none;white-space:nowrap;
  border-right:2px solid var(--border);
  max-width:var(--dt-w, none);
  transition:max-width ${COLLAPSE_MS}ms ${COLLAPSE_EASE};
  transition-delay:var(--dt-collapse-delay, 0ms);
}
.dt-root .dt-li:last-child{border-right:none}
.dt-root .dt-li[data-collapsed="true"]{max-width:${COLLAPSED_WIDTH}px}
.dt-root .dt-slide-inner{
  display:inline-flex;align-items:center;padding:6px 10px;
  transition:transform ${COLLAPSE_MS}ms ${COLLAPSE_EASE}, opacity 200ms ease-out;
  transition-delay:var(--dt-collapse-delay, 0ms);
}
.dt-root .dt-li[data-collapsed="true"] .dt-slide-inner{transform:translateX(-14px);opacity:0.35}
.dt-root:hover .dt-li[data-collapsed="true"],
.dt-root:focus-within .dt-li[data-collapsed="true"]{
  max-width:var(--dt-w, 200px);
  transition:max-width ${EXPAND_MS}ms var(--dt-expand-ease, ease-out);
  transition-delay:var(--dt-expand-delay, 0ms);
}
.dt-root:hover .dt-li[data-collapsed="true"] .dt-slide-inner,
.dt-root:focus-within .dt-li[data-collapsed="true"] .dt-slide-inner{
  transform:translateX(0);opacity:1;
  transition:transform ${EXPAND_MS}ms var(--dt-expand-ease, ease-out), opacity 260ms ease-out;
  transition-delay:var(--dt-expand-delay, 0ms);
}
.dt-root .dt-link{color:var(--muted);text-decoration:none;border-radius:4px}
.dt-root .dt-link:hover{color:var(--foreground)}
.dt-root .dt-link:focus-visible{outline:2px solid var(--accent);outline-offset:2px;color:var(--foreground)}
.dt-root .dt-current{color:var(--foreground);font-weight:500}
@media (prefers-reduced-motion: reduce){
  .dt-root .dt-li,
  .dt-root .dt-slide-inner{transition:none !important;transition-delay:0s !important}
}
`}</style>

      {/* Hidden measurement clone: mirrors the real markup so each crumb's
          natural (uncollapsed) width can be read even while the real one is
          locked to 2px. Never the source of truth for a11y — aria-hidden,
          inert to interaction, out of the visual flow. */}
      <ol
        aria-hidden="true"
        className="dt-ol"
        style={{
          position: "absolute",
          top: -9999,
          left: 0,
          height: 0,
          overflow: "hidden",
          visibility: "hidden",
          display: "flex",
          pointerEvents: "none",
        }}
      >
        {items.map((item, i) => (
          <li
            key={item.id}
            ref={(el) => {
              hiddenRefs.current[i] = el;
            }}
            data-dt-idx={i}
            className="dt-li"
            style={{ maxWidth: "none" } as Vars}
          >
            <CrumbContent label={item.label} />
          </li>
        ))}
      </ol>

      <nav aria-label="Breadcrumb">
        <ol role="list" className="dt-ol flex items-center text-sm">
          {items.map((item, i) => {
            const isLast = i === items.length - 1;
            const isCollapsed = collapsed.has(i);
            const naturalWidth = itemWidths[i];
            const orderInSet = collapsedOrder.indexOf(i);
            const setLen = collapsedOrder.length;
            const expandRank = orderInSet >= 0 ? orderInSet : 0;
            const collapseRank = orderInSet >= 0 ? setLen - 1 - orderInSet : 0;
            const overshoot = (1.5 + expandRank * 0.12).toFixed(2);
            const style: Vars = {
              "--dt-w": naturalWidth ? `${Math.ceil(naturalWidth)}px` : "none",
              "--dt-collapse-delay": `${collapseRank * STAGGER_MS}ms`,
              "--dt-expand-delay": `${expandRank * STAGGER_MS}ms`,
              "--dt-expand-ease": `cubic-bezier(0.34, ${overshoot}, 0.64, 1)`,
            };

            return (
              <li
                key={item.id}
                data-dt-idx={i}
                data-collapsed={isCollapsed ? "true" : "false"}
                className="dt-li"
                style={style}
              >
                <span className="dt-slide-inner">
                  {isLast ? (
                    <span aria-current="page" className="dt-current">
                      {item.label}
                    </span>
                  ) : (
                    <a href={item.href ?? "#"} className="dt-link" onClick={handleClick(item)}>
                      {item.label}
                    </a>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
