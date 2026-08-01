"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type PointsThrowTab = {
  id: string;
  label: string;
  content: ReactNode;
};

// Tabs whose active indicator is one continuous SVG rail running under the
// entire tab row like railway track, not a discrete indicator object. A thin
// base polyline (--border, 1px) spans the full row at baseline — the track
// bed, always present, never animated. A second polyline (--foreground, 2px)
// rides on top of it and is locally lifted into a plateau under the active
// tab, joining the baseline again on either side via a short diagonal ramp —
// a railway "siding". Selecting a different tab THROWS THE POINTS: the four
// x-coordinates that describe the ramp-plateau-ramp shape tween from their
// old positions to the new tab's positions on an ease-out-expo curve over
// 350ms, direct-DOM (no React state on the hot path), so the bend visibly
// travels down the line rather than a puck jumping between slots. Distinct
// from segmented-control-fling: there is never a discrete indicator object, only one
// line whose geometry changes.
export function PointsThrow({
  tabs,
  defaultTab,
  className = "",
}: {
  tabs: PointsThrowTab[];
  /** id of the initially selected tab (defaults to the first) */
  defaultTab?: string;
  className?: string;
}) {
  const baseId = useId();
  const [active, setActive] = useState(() => defaultTab ?? tabs[0]?.id ?? "");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const baseRailRef = useRef<SVGPolylineElement>(null);
  const sidingRef = useRef<SVGPolylineElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  // hot-path geometry lives in a ref — the rAF tween never touches React
  const sim = useRef({
    x: [0, 0, 0, 0] as [number, number, number, number], // ramp-L, plateau-L, plateau-R, ramp-R
    rowWidth: 0,
    raf: 0,
    settledOnce: false,
    reduced: false,
  });

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === active));
  const tabsKey = tabs.map((t) => t.id).join(" ");

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const s = sim.current;
    s.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const render = () => {
      const base = baseRailRef.current;
      const siding = sidingRef.current;
      if (!base || !siding) return;
      const w = s.rowWidth;
      base.setAttribute("points", `0,${BASE_Y} ${w},${BASE_Y}`);
      const [x0, x1, x2, x3] = s.x;
      siding.setAttribute(
        "points",
        `${x0},${BASE_Y} ${x1},${RAISED_Y} ${x2},${RAISED_Y} ${x3},${BASE_Y}`
      );
    };

    const stopAnim = () => {
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
    };

    const animateTo = (target: [number, number, number, number]) => {
      stopAnim();
      const from: [number, number, number, number] = [...s.x];
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION_MS);
        const e = easeOutExpo(t);
        s.x = [
          from[0] + (target[0] - from[0]) * e,
          from[1] + (target[1] - from[1]) * e,
          from[2] + (target[2] - from[2]) * e,
          from[3] + (target[3] - from[3]) * e,
        ];
        render();
        if (t < 1) {
          s.raf = requestAnimationFrame(step);
        } else {
          s.raf = 0;
        }
      };
      s.raf = requestAnimationFrame(step);
    };

    const measure = () => {
      const list = listRef.current;
      const el = tabRefs.current.get(active);
      if (!list || !el) return;
      const wrapRect = wrapper.getBoundingClientRect();
      const rowWidth = wrapRect.width;
      if (rowWidth < 8) return;
      const elRect = el.getBoundingClientRect();
      const tabLeft = elRect.left - wrapRect.left;
      const tabRight = tabLeft + elRect.width;
      const target: [number, number, number, number] = [
        clamp(tabLeft - RAMP, 0, rowWidth),
        tabLeft,
        tabRight,
        clamp(tabRight + RAMP, 0, rowWidth),
      ];
      s.rowWidth = rowWidth;

      if (!s.settledOnce || s.reduced) {
        stopAnim();
        s.x = target;
        render();
        s.settledOnce = true;
        return;
      }
      animateTo(target);
    };

    measure();
    // ResizeObserver always delivers one initial callback the instant it
    // starts observing — and this effect (re-)runs on every tab switch, so
    // that initial delivery would otherwise land a frame into the throw
    // tween and stomp it back to a snap. Skip only that first delivery per
    // effect run; any later delivery is a genuine layout change.
    let firstDelivery = true;
    const ro = new ResizeObserver(() => {
      if (firstDelivery) {
        firstDelivery = false;
        return;
      }
      // layout change, not a selection — reseat instantly, never tween
      stopAnim();
      s.settledOnce = false;
      measure();
    });
    ro.observe(wrapper);

    return () => {
      ro.disconnect();
      stopAnim();
    };
  }, [active, tabsKey]);

  // panel: 12px lateral slide-fade in the direction of travel; reduced
  // motion drops the translate in favor of a plain crossfade
  const prevIndex = useRef(activeIndex);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const reduced = sim.current.reduced;
    const dir = activeIndex >= prevIndex.current ? 1 : -1;
    prevIndex.current = activeIndex;
    if (reduced) {
      panel.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 150,
        easing: "ease-out",
      });
      return;
    }
    panel.animate(
      [
        { opacity: 0, transform: `translateX(${dir * PANEL_SLIDE}px)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 220, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
    );
  }, [activeIndex]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (activeIndex + 1) % tabs.length;
    else if (e.key === "ArrowLeft")
      next = (activeIndex - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === -1) return;
    e.preventDefault();
    const id = tabs[next]?.id;
    if (!id) return;
    setActive(id);
    tabRefs.current.get(id)?.focus();
  };

  const activeTab = tabs[activeIndex];

  return (
    <div className={className}>
      <div ref={wrapperRef} className="relative">
        <div
          ref={listRef}
          role="tablist"
          aria-label="Sections"
          className="flex"
          onKeyDown={onKeyDown}
        >
          {tabs.map((tab) => {
            const selected = tab.id === active;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(tab.id, el);
                  else tabRefs.current.delete(tab.id);
                }}
                role="tab"
                id={`${baseId}-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(tab.id)}
                className={`relative rounded-sm px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                  selected
                    ? "font-medium text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {/* the track: base rail spans the whole row at baseline; the siding
            polyline rides on top of it and bends up into a plateau under
            whichever tab is active. Purely decorative — selection lives in
            aria-selected, never here. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-full h-[10px] w-full overflow-visible"
        >
          <polyline
            ref={baseRailRef}
            points=""
            fill="none"
            stroke="var(--border)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            ref={sidingRef}
            points=""
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      {activeTab && (
        <div
          ref={panelRef}
          role="tabpanel"
          id={`${baseId}-panel-${activeTab.id}`}
          aria-labelledby={`${baseId}-tab-${activeTab.id}`}
          tabIndex={0}
          className="rounded-sm px-1 py-4 text-sm leading-relaxed text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
}

const RAMP = 10; // px — horizontal run of each diagonal ramp
const SVG_H = 10; // px — svg box height
const BASE_Y = SVG_H - 1; // baseline, near the bottom of the box
const RAISED_Y = 1; // plateau, lifted toward the tab label above
const DURATION_MS = 350; // tabs-rail-points tween duration
const PANEL_SLIDE = 12; // px — panel lateral slide-fade distance

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
