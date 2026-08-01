"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type MortiseSlipTab = {
  id: string;
  label: string;
  content: ReactNode;
};

// ---------------------------------------------------------------------------
// MortiseSlip — tabs as joinery. The tab strip's bottom rule is a single
// SVG <path> with a notch (mortise) missing under the active tab, and the
// panel below carries a matching raised tenon (a 6px-radius nub) that pokes
// up 1px into that gap — the two pieces read as one interrupted border, not
// a floating bar under a label (contrast carriage-return/shadcn/Radix) and
// not a cut-based caret (contrast kerf-caret, which is a streaming-text
// cursor, not a tab indicator at all). At rest, with zero motion, which
// panel belongs to which tab is legible from the joint alone. On switch the
// notch's x/width chase the newly active tab's measured rect on an
// underdamped spring (k=300, c=26 — a small overshoot reads as the joint
// tapping home) while the panel content translates ±16px from the travel
// direction and cross-fades in over ~220ms, the outgoing content fading out
// on top over ~120ms. Direction always matches index delta. Pure DOM+SVG,
// no canvas; ink is token-relative (--border/--foreground/--muted/
// --background) throughout. Reduced motion: the notch snaps instantly and
// the panel does a plain opacity cross-fade with no translate.
// ---------------------------------------------------------------------------

const SPRING_K = 300; // s^-2 stiffness
const SPRING_C = 26; // s^-1 damping — underdamped, a tiny overshoot on arrival
const TENON_PROTRUDE = 6; // px the tenon pokes above the boundary
const TENON_OVERLAP = 1; // px the tenon overlaps below the boundary
const TENON_H = TENON_PROTRUDE + TENON_OVERLAP;
const PANEL_SHIFT = 16; // px
const ENTER_MS = 220;
const FADE_MS = 120;
const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";

export function MortiseSlip({
  tabs,
  defaultTab,
  value,
  onValueChange,
  className = "",
  "aria-label": ariaLabel = "Sections",
}: {
  tabs: MortiseSlipTab[];
  /** id of the initially selected tab (uncontrolled); defaults to the first */
  defaultTab?: string;
  /** controlled selected tab id; omit for uncontrolled */
  value?: string;
  onValueChange?: (id: string) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const baseId = useId();
  const isControlled = value !== undefined;
  const [internalActive, setInternalActive] = useState(
    () => defaultTab ?? tabs[0]?.id ?? ""
  );
  const active = isControlled ? (value as string) : internalActive;
  let activeIndex = tabs.findIndex((t) => t.id === active);
  if (activeIndex < 0) activeIndex = 0;
  const activeTab = tabs[activeIndex];

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const tenonRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const outgoingRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  // hot-path spring state lives in a ref — the rAF loop never touches React
  const sim = useRef({
    x: 0,
    w: 0,
    vx: 0,
    vw: 0,
    tx: 0,
    tw: 0,
    full: 0,
    boundaryY: 0,
    raf: 0,
    sized: false,
    reduced: false,
  });

  const [transition, setTransition] = useState<{
    key: number;
    dir: 1 | -1;
    from: ReactNode;
  } | null>(null);
  const transitionSeq = useRef(0);

  function selectTab(id: string) {
    const toIndex = tabs.findIndex((t) => t.id === id);
    if (toIndex < 0 || toIndex === activeIndex) return;
    const dir: 1 | -1 = toIndex > activeIndex ? 1 : -1;
    transitionSeq.current += 1;
    setTransition({ key: transitionSeq.current, dir, from: activeTab?.content });
    if (!isControlled) setInternalActive(id);
    onValueChange?.(id);
  }

  // -- the joint: notch x/width chase the active tab's measured rect -------
  useEffect(() => {
    const root = rootRef.current;
    const list = listRef.current;
    const svg = svgRef.current;
    const path = pathRef.current;
    const tenon = tenonRef.current;
    if (!root || !list || !svg || !path || !tenon) return;
    const s = sim.current;
    s.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const paint = () => {
      const y = s.boundaryY;
      const x1 = Math.max(0, Math.min(s.full, s.x));
      const x2 = Math.max(0, Math.min(s.full, s.x + s.w));
      svg.style.top = `${y - 1}px`;
      path.setAttribute(
        "d",
        `M0,1 L${x1.toFixed(2)},1 M${x2.toFixed(2)},1 L${s.full.toFixed(2)},1`
      );
      tenon.style.top = `${y - TENON_PROTRUDE}px`;
      tenon.style.left = `${s.x.toFixed(2)}px`;
      tenon.style.width = `${Math.max(0, s.w).toFixed(2)}px`;
    };

    const wake = () => {
      if (!s.raf && !s.reduced) {
        last = 0;
        s.raf = requestAnimationFrame(loop);
      }
    };

    const measure = () => {
      const rootRect = root.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      s.boundaryY = listRect.bottom - rootRect.top;
      s.full = rootRect.width;
      svg.style.width = `${s.full}px`;
      svg.setAttribute("viewBox", `0 0 ${Math.max(1, s.full)} 2`);
      svg.setAttribute("preserveAspectRatio", "none");
      const el = tabRefs.current.get(active);
      if (!el) return;
      const r = el.getBoundingClientRect();
      s.tx = r.left - rootRect.left;
      s.tw = r.width;
      if (!s.sized || s.reduced) {
        s.x = s.tx;
        s.w = s.tw;
        s.vx = s.vw = 0;
        s.sized = true;
        svg.style.opacity = "1";
        tenon.style.opacity = "1";
        paint();
        return;
      }
      paint(); // keep the boundary/full-width in sync even while resting
      wake();
    };

    const step = (dt: number) => {
      s.vx += (SPRING_K * (s.tx - s.x) - SPRING_C * s.vx) * dt;
      s.vw += (SPRING_K * (s.tw - s.w) - SPRING_C * s.vw) * dt;
      s.x += s.vx * dt;
      s.w += s.vw * dt;
    };

    let last = 0;
    const loop = (t: number) => {
      const dt = Math.min((t - (last || t)) / 1000, 1 / 30);
      last = t;
      step(dt);
      const settled =
        Math.abs(s.tx - s.x) < 0.25 &&
        Math.abs(s.tw - s.w) < 0.25 &&
        Math.abs(s.vx) < 4 &&
        Math.abs(s.vw) < 4;
      if (settled) {
        s.x = s.tx;
        s.w = s.tw;
        s.vx = s.vw = 0;
      }
      paint();
      if (settled) {
        s.raf = 0;
        return;
      }
      s.raf = requestAnimationFrame(loop);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(list);
    return () => {
      ro.disconnect();
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [active, tabs.length]);

  // -- panel: translate + cross-fade on every switch ------------------------
  useEffect(() => {
    if (!transition) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const panel = panelRef.current;
    const outgoing = outgoingRef.current;
    if (panel) {
      if (reduced) {
        panel.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: FADE_MS,
          easing: "linear",
        });
      } else {
        panel.animate(
          [
            {
              opacity: 0,
              transform: `translateX(${transition.dir * PANEL_SHIFT}px)`,
            },
            { opacity: 1, transform: "translateX(0)" },
          ],
          { duration: ENTER_MS, easing: EASE_OUT_EXPO }
        );
      }
    }
    if (outgoing) {
      outgoing.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: FADE_MS,
        easing: "linear",
        fill: "forwards",
      });
    }
    const t = window.setTimeout(
      () => setTransition(null),
      reduced ? FADE_MS : Math.max(ENTER_MS, FADE_MS)
    );
    return () => window.clearTimeout(t);
  }, [transition]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (tabs.length === 0) return;
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
    selectTab(id);
    tabRefs.current.get(id)?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={`relative overflow-hidden rounded-xl border border-border bg-background ${className}`}
    >
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className="relative flex gap-1 p-1"
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
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              className={`relative z-10 rounded-md px-3.5 py-2 text-sm transition-colors duration-150 hover:bg-foreground/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
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

      {/* the rule: one path, notched under the active tab — aria-hidden,
          selection is carried entirely by aria-selected + label weight */}
      <svg
        ref={svgRef}
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute left-0 h-[2px] overflow-visible opacity-0"
      >
        <path ref={pathRef} stroke="var(--border)" strokeWidth={1} fill="none" />
      </svg>

      {/* the tenon: a raised nub that slots into the notch above */}
      <div
        ref={tenonRef}
        aria-hidden="true"
        className="pointer-events-none absolute rounded-md border border-border bg-background opacity-0"
        style={{ height: TENON_H }}
      />

      <div className="relative">
        {transition && (
          <div
            ref={outgoingRef}
            aria-hidden="true"
            inert
            className="pointer-events-none absolute inset-x-0 top-0"
          >
            {transition.from}
          </div>
        )}
        {activeTab && (
          <div
            ref={panelRef}
            role="tabpanel"
            id={`${baseId}-panel-${activeTab.id}`}
            aria-labelledby={`${baseId}-tab-${activeTab.id}`}
            tabIndex={0}
            className="relative text-sm leading-relaxed text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {activeTab.content}
          </div>
        )}
      </div>
    </div>
  );
}
