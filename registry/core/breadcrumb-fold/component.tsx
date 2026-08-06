"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// BellowsCrumb — a breadcrumb that behaves like a camera bellows. Ancestor
// segments rest pleated into narrow slivers (label clipped, three 1px fold
// lines in --border, a mask fade on the text edge); the current segment sits
// fully extended. Hovering or focusing any sliver expands it to its measured
// natural width while its neighbours redistribute the remaining budget
// proportionally — never removing a level (unlike an ellipsis-menu
// breadcrumb) and never articulating at a joint (unlike a hinged tree).
//
// The conservation trick is arithmetic, not physics: every segment's
// flex-basis animates on the exact same CSS transition (duration + easing),
// so at any instant t all of them sit at start_i + (end_i - start_i)*e(t).
// Because sum(start_i) == sum(end_i) == the available width by construction,
// sum(start_i) + (sum(end_i) - sum(start_i)) * e(t) collapses to a constant
// — the row's total width never wobbles mid-spring, even with an
// overshooting bezier, with no per-frame JS loop required.
//
// Natural widths are read from a hidden ghost copy of the full trail
// (absolute, invisible, nowrap, same padding as the real row) so measuring
// the visible — already-clipped — row can never feed back into itself.
// ---------------------------------------------------------------------------

export type BellowsCrumbItem = {
  id: string;
  label: string;
  /** Renders an <a>. Omit and the segment renders a <button>. */
  href?: string;
};

export interface BellowsCrumbProps {
  /** Ordered root → current. The last item is the current page. */
  items: BellowsCrumbItem[];
  /** called when a non-current crumb is activated */
  onNavigate?: (item: BellowsCrumbItem, index: number) => void;
  /** Width a pleated segment rests at. Default 20. */
  pleat?: number;
  /** accessible name for the breadcrumb nav */
  ariaLabel?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const SEP_WIDTH = 26; // fixed chevron + margins — not content-dependent, no measuring needed
const TRANSITION =
  "flex-basis 420ms cubic-bezier(0.34, 1.56, 0.64, 1)"; // identical on every segment — load-bearing for conservation

function computeWidths(
  natural: number[],
  available: number,
  expandedIndex: number,
  pleat: number
): number[] {
  const n = natural.length;
  if (n === 0) return [];
  const safeAvail = Math.max(available, pleat * n);
  if (n === 1) return [safeAvail];
  const floorTotal = pleat * (n - 1);
  const maxExpanded = Math.max(pleat, safeAvail - floorTotal);
  const expandedWidth = Math.min(natural[expandedIndex] ?? pleat, maxExpanded);
  const remaining = safeAvail - expandedWidth;
  const extra = remaining - floorTotal; // always >= 0, expandedWidth is capped above
  const othersSum =
    natural.reduce((sum, w, i) => (i === expandedIndex ? sum : sum + w), 0) ||
    1;
  return natural.map((w, i) =>
    i === expandedIndex ? expandedWidth : pleat + extra * (w / othersSum)
  );
}

export function BellowsCrumb({
  items,
  onNavigate,
  pleat = 20,
  ariaLabel = "Breadcrumb",
  className = "",
}: BellowsCrumbProps) {
  const navRef = useRef<HTMLElement>(null);
  const ghostRef = useRef<(HTMLLIElement | null)[]>([]);

  const [natural, setNatural] = useState<number[]>(() => items.map(() => 0));
  const [available, setAvailable] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);

  const lastIndex = items.length - 1;
  const expandedIndex = hovered ?? focused ?? lastIndex;

  const signature = items.map((i) => `${i.id}${i.label}`).join("\0");

  const measure = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const n = items.length;
    const widths = ghostRef.current
      .slice(0, n)
      .map((el) => el?.getBoundingClientRect().width ?? 0);
    if (widths.length < n || widths.some((w) => w === 0)) return; // not laid out yet

    const avail = nav.clientWidth - SEP_WIDTH * Math.max(0, n - 1);
    setAvailable((prev) => (prev === avail ? prev : avail));
    setNatural((prev) => {
      if (prev.length === widths.length && prev.every((v, i) => Math.abs(v - widths[i]) < 0.5)) {
        return prev;
      }
      return widths;
    });
  }, [items.length]);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // layout effect — measures the ghost row and sets the first real widths
  // before the browser paints, so mount never flashes the zero-width default
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(nav);

    let live = true;
    if (document.fonts) {
      document.fonts.ready.then(() => {
        if (live) measure();
      });
    }

    return () => {
      live = false;
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, signature]);

  const widths = computeWidths(natural, available, expandedIndex, pleat);

  const expand = (index: number) => () => setHovered(index);
  const unexpand = () => setHovered(null);

  // A pointerleave whose relatedTarget is still part of the bellows (a
  // sibling segment or the fixed-width separator gap between two segments)
  // means the pointer is just transiting, not leaving. Collapsing here was
  // the bug: nulling hovered mid-transit shrinks the expanded segment away
  // from the cursor, which lands a *different* segment under the now-static
  // cursor, re-triggering enter/leave in a loop — the "hover flicker" the
  // owner saw when crossing a separator arrow. Only an actual exit (related
  // target outside the whole trail) should collapse.
  const isBellowsPart = (el: EventTarget | null) =>
    !!(el as Element | null)?.closest?.(
      "[data-bellows-seg], [data-bellows-sep]"
    );

  const onLeaveSeg = (e: ReactPointerEvent<HTMLElement>) => {
    if (isBellowsPart(e.relatedTarget)) return;
    unexpand();
  };
  const onLeaveSep = (e: ReactPointerEvent<HTMLElement>) => {
    if (isBellowsPart(e.relatedTarget)) return;
    unexpand();
  };

  const onFocusSeg = (index: number) => () => setFocused(index);
  const onBlurSeg = (e: ReactFocusEvent<HTMLElement>) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (related?.hasAttribute("data-bellows-seg")) return; // moving to a sibling segment — its onFocus supersedes, no flash
    setFocused(null);
  };

  const navigate = (item: BellowsCrumbItem, index: number) => {
    onNavigate?.(item, index);
  };

  return (
    <nav
      ref={navRef}
      aria-label={ariaLabel}
      className={`relative w-full min-w-0 ${className}`}
    >
      <ol className="flex min-w-0 flex-nowrap items-center overflow-hidden">
        {items.map((item, index) => {
          const isExpanded = index === expandedIndex;
          const isCurrent = index === lastIndex;
          const width = widths[index] ?? pleat;

          const controlClass = [
            "block w-full whitespace-nowrap rounded-sm px-2 py-1 text-sm",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ns-accent",
            isCurrent
              ? "font-medium text-foreground"
              : "text-ns-muted transition-colors duration-150 hover:text-foreground",
          ].join(" ");

          const labelStyle: CSSProperties = isExpanded
            ? {}
            : {
                overflow: "hidden",
                maskImage: "linear-gradient(to right, black 60%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to right, black 60%, transparent 100%)",
              };

          const common = {
            "data-bellows-seg": index,
            "data-state": isExpanded ? "expanded" : "pleated",
            className: controlClass,
            style: labelStyle,
            onPointerEnter: expand(index),
            onPointerLeave: onLeaveSeg,
            onFocus: onFocusSeg(index),
            onBlur: onBlurSeg,
            onClick: () => navigate(item, index),
            ...(isCurrent ? { "aria-current": "page" as const } : {}),
          };

          return (
            <li
              key={item.id}
              className="relative flex min-w-0 shrink-0 grow-0 items-center overflow-hidden"
              style={{ flexBasis: width, transition: reduced ? "none" : TRANSITION }}
            >
              {item.href ? (
                <a href={item.href} {...common}>
                  {item.label}
                </a>
              ) : (
                <button type="button" {...common}>
                  {item.label}
                </button>
              )}

              {/* three fold lines — only visible while this sliver is compressed */}
              {!isExpanded && (
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-1.5">
                  {[0.25, 0.5, 0.75].map((frac) => (
                    <span
                      key={frac}
                      className="absolute top-0 h-full w-px bg-border"
                      style={{ left: `${frac * 100}%` }}
                    />
                  ))}
                </span>
              )}
            </li>
          );
        }).reduce<ReactNode[]>((acc, seg, i) => {
          acc.push(seg);
          if (i < items.length - 1) {
            acc.push(
              <li
                key={`sep-${items[i].id}`}
                aria-hidden="true"
                data-bellows-sep=""
                className="flex shrink-0 grow-0 items-center justify-center"
                style={{ flexBasis: SEP_WIDTH }}
                onPointerLeave={onLeaveSep}
              >
                <Chevron className="text-ns-muted" angle={expandedIndex > i ? 15 : -15} />
              </li>
            );
          }
          return acc;
        }, [])}
      </ol>

      {/* measurement ghost — full trail at natural width, out of flow, never
          fed by the (already-clipped) visible row */}
      <ol
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 flex flex-nowrap items-center whitespace-nowrap"
      >
        {items.map((item, index) => (
          <li
            key={item.id}
            ref={(el) => {
              ghostRef.current[index] = el;
            }}
            className="whitespace-nowrap rounded-sm px-2 py-1 text-sm font-medium"
          >
            {item.label}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Chevron({
  angle,
  className = "",
}: {
  angle: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      width="12"
      height="12"
      className={className}
      style={{
        transform: `rotate(${angle}deg)`,
        transition: "transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      <path
        d="M4.5 2.5 8 6l-3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
