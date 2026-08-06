"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type CarriageTab = {
  id: string;
  label: string;
  content: ReactNode;
};

// Typewriter-carriage tab indicator: the underline is a carriage on a rail.
// Forward moves glide on a spring with velocity-proportional stretch; a
// backward move is a carriage RETURN — faster, harder overshoot, and a small
// vertical ding-bounce on arrival. Direct-DOM rAF, zero React state on the
// hot path.
export function CarriageReturn({
  tabs,
  defaultTab,
  className = "",
}: {
  /** the tabs, in order */
  tabs: CarriageTab[];
  /** id of the initially selected tab (defaults to the first) */
  defaultTab?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}) {
  const baseId = useId();
  const [active, setActive] = useState(
    () => defaultTab ?? tabs[0]?.id ?? ""
  );
  const listRef = useRef<HTMLDivElement>(null);
  const carriageRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  // spring state lives in a ref — the loop never touches React
  const sim = useRef({
    x: 0,
    w: 0,
    y: 0,
    vx: 0,
    vw: 0,
    vy: 0,
    tx: 0,
    tw: 0,
    raf: 0,
    settledOnce: false,
    reduced: false,
  });

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === active)
  );

  // retarget the springs whenever the active tab (or layout) changes
  useEffect(() => {
    const list = listRef.current;
    const carriage = carriageRef.current;
    if (!list || !carriage) return;
    const s = sim.current;
    s.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const measure = () => {
      const el = tabRefs.current.get(active);
      if (!el) return;
      const wasLeft = s.tx;
      s.tx = el.offsetLeft;
      s.tw = el.offsetWidth;
      if (!s.settledOnce || s.reduced) {
        // first paint / reduced motion: place, don't animate
        s.x = s.tx;
        s.w = s.tw;
        s.vx = s.vw = s.vy = 0;
        s.y = 0;
        carriage.style.transform = `translateX(${s.x}px)`;
        carriage.style.width = `${s.w}px`;
        s.settledOnce = true;
        return;
      }
      // backward travel = carriage return: kick harder, add the ding dip
      if (s.tx < wasLeft - 1) {
        s.vx -= (wasLeft - s.tx) * 4;
        s.vy = 60; // downward ding, springs back
      }
      wake();
    };

    const K = 380; // s^-2
    const ZETA = 0.72;
    const step = (dt: number) => {
      const c = 2 * ZETA * Math.sqrt(K);
      s.vx += (K * (s.tx - s.x) - c * s.vx) * dt;
      s.vw += (K * (s.tw - s.w) - c * s.vw) * dt;
      s.vy += (900 * (0 - s.y) - 2 * 0.5 * Math.sqrt(900) * s.vy) * dt;
      s.x += s.vx * dt;
      s.w += s.vw * dt;
      s.y += s.vy * dt;
    };

    let last = 0;
    const loop = (t: number) => {
      const dt = Math.min((t - (last || t)) / 1000, 1 / 30);
      last = t;
      step(dt);
      const settled =
        Math.abs(s.tx - s.x) < 0.3 &&
        Math.abs(s.tw - s.w) < 0.3 &&
        Math.abs(s.vx) < 4 &&
        Math.abs(s.y) < 0.3 &&
        Math.abs(s.vy) < 4;
      if (settled) {
        s.x = s.tx;
        s.w = s.tw;
        s.y = 0;
        s.vx = s.vw = s.vy = 0;
      }
      // velocity-proportional stretch; squash falls out of the overshoot
      const stretch = 1 + Math.min(Math.abs(s.vx) / 2600, 0.45);
      carriage.style.transform = `translateX(${s.x}px) translateY(${s.y * 0.06}px) scaleX(${stretch})`;
      carriage.style.width = `${s.w}px`;
      if (settled) {
        carriage.style.transform = `translateX(${s.x}px)`;
        s.raf = 0;
        return;
      }
      s.raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!s.raf) {
        last = 0;
        s.raf = requestAnimationFrame(loop);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => {
      ro.disconnect();
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [active]);

  // panel line-feed: new content enters from the travel direction
  const prevIndex = useRef(activeIndex);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (sim.current.reduced) return;
    const dir = activeIndex >= prevIndex.current ? 1 : -1;
    prevIndex.current = activeIndex;
    panel.animate(
      [
        { opacity: 0, transform: `translateX(${dir * 12}px)` },
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
    const id = tabs[next].id;
    setActive(id);
    tabRefs.current.get(id)?.focus();
  };

  const activeTab = tabs[activeIndex];

  return (
    <div className={className}>
      <div className="relative border-b border-border">
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
                className={`relative rounded-sm px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ns-accent ${
                  selected
                    ? "font-medium text-foreground"
                    : "text-ns-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {/* the carriage: rides the rail (the border-b) */}
        <div
          ref={carriageRef}
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-px left-0 h-0.5 bg-foreground"
          style={{ transformOrigin: "center" }}
        />
      </div>
      {activeTab && (
        <div
          ref={panelRef}
          role="tabpanel"
          id={`${baseId}-panel-${activeTab.id}`}
          aria-labelledby={`${baseId}-tab-${activeTab.id}`}
          tabIndex={0}
          className="rounded-sm px-1 py-4 text-sm leading-relaxed text-ns-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
}
