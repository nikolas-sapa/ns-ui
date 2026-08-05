"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ScrollIsland — a header that morphs between a full-width quiet nav bar (at
// page top) and a floating, centered pill (once scrolled), tracking a
// "dynamic island" reference. Everything that moves every frame — pill
// width/radius/padding/translateY, the section-label roll, the progress
// hairline width, the lift/border-brighten on hover — is written straight to
// refs' inline styles inside a single rAF loop; React state only holds
// discrete things (which section is active, open/closed banding, reduced
// motion) that change rarely and are fine to re-render on.
//
// Scroll math: a single continuous "openness" value in [0,1] (0 = compact
// pill, 1 = full bar) is derived from scrollY with a hysteresis band — it
// only starts closing past CLOSE_Y and only starts reopening once scrollY
// drops back under OPEN_Y, so resting exactly on a single pixel threshold
// can never flutter between states. A fast upward scroll (large negative
// scrollY delta inside one rAF tick) snaps openness toward 1 immediately
// and plays a brief overshoot (a scale pulse past 1 that eases back) rather
// than the normal lerped approach.
// ---------------------------------------------------------------------------

export interface ScrollIslandSection {
  id: string;
  label: string;
}

export interface ScrollIslandProps {
  wordmark?: string;
  sections?: ScrollIslandSection[];
  /** id of the currently active section; the label rolls when this changes */
  activeId?: string;
  className?: string;
}

const DEFAULT_SECTIONS: ScrollIslandSection[] = [
  { id: "intro", label: "Intro" },
  { id: "work", label: "Work" },
  { id: "process", label: "Process" },
  { id: "contact", label: "Contact" },
];

const CLOSE_Y = 72; // px scrolled before it starts compacting
const OPEN_Y = 40; // px scrolled below which it starts reopening (< CLOSE_Y = hysteresis band)
const LERP_RATE = 10; // 1/s — approach speed toward target openness
const FLICK_DELTA = -28; // px/frame upward delta that counts as a "fast flick"
const OVERSHOOT_MS = 260;

const PILL_W_PX = 300;
const BAR_RADIUS = 0;
const PILL_RADIUS = 999;
const BAR_PAD_X = 24;
const PILL_PAD_X = 18;
const BAR_H = 60;
const PILL_H = 44;
const PILL_TOP = 14;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

export function ScrollIsland({
  wordmark = "ns-ui",
  sections = DEFAULT_SECTIONS,
  activeId,
  className = "",
}: ScrollIslandProps) {
  const pillRef = useRef<HTMLDivElement | null>(null);
  const barLinksRef = useRef<HTMLDivElement | null>(null);
  const labelTrackRef = useRef<HTMLSpanElement | null>(null);
  const hairlineRef = useRef<HTMLDivElement | null>(null);

  const [reduced, setReduced] = useState(false);
  const [internalActive, setInternalActive] = useState(sections[0]?.id);
  const [focusExpanded, setFocusExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [compact, setCompact] = useState(false); // discrete: drives reduced-motion + a11y state only

  const active = activeId ?? internalActive;
  const activeIndex = useMemo(
    () => Math.max(0, sections.findIndex((s) => s.id === active)),
    [sections, active]
  );

  // ---- reduced motion -------------------------------------------------
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // ---- section auto-detection (only when caller doesn't control it) --
  useEffect(() => {
    if (activeId !== undefined) return;
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const id = visible.target.id;
          setInternalActive(id);
        }
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections, activeId]);

  // ---- label vertical roll on section change --------------------------
  const prevLabelRef = useRef(sections[activeIndex]?.label ?? "");
  useEffect(() => {
    const label = sections[activeIndex]?.label ?? "";
    const track = labelTrackRef.current;
    if (!track) {
      prevLabelRef.current = label;
      return;
    }
    if (prevLabelRef.current === label) return;
    prevLabelRef.current = label;
    if (reduced) {
      track.textContent = label;
      return;
    }
    // roll: slide current out upward, swap text, slide in from below
    track.style.transition = "none";
    track.style.transform = "translateY(0%)";
    track.textContent = label;
    // force reflow so the "from" transform is committed before animating
    void track.offsetHeight;
    track.style.transform = "translateY(-100%)";
    requestAnimationFrame(() => {
      track.style.transition = "transform 260ms cubic-bezier(0.16,1,0.3,1)";
      track.style.transform = "translateY(0%)";
    });
  }, [activeIndex, sections, reduced]);

  // ---- rAF scroll-driven morph -----------------------------------------
  const opennessRef = useRef(1);
  const lastYRef = useRef(0);
  const overshootUntilRef = useRef(0);

  const applyFrame = useCallback(
    (openness: number, overshoot: number, expanded: boolean, lift: boolean) => {
      const pill = pillRef.current;
      const links = barLinksRef.current;
      const hairline = hairlineRef.current;
      if (!pill) return;

      const o = expanded ? 1 : openness;
      const width = lerp(PILL_W_PX, window.innerWidth, o);
      const widthCss = o > 0.985 ? "100%" : `${width}px`;
      const radius = lerp(PILL_RADIUS, BAR_RADIUS, o);
      const padX = lerp(PILL_PAD_X, BAR_PAD_X, o);
      const height = lerp(PILL_H, BAR_H, o);
      const top = lerp(PILL_TOP, 0, o);
      const scale = 1 + overshoot * 0.02;
      const liftPx = lift && o < 0.5 ? -1 : 0;

      pill.style.width = widthCss;
      pill.style.borderRadius = `${radius}px`;
      pill.style.paddingLeft = `${padX}px`;
      pill.style.paddingRight = `${padX}px`;
      pill.style.height = `${height}px`;
      pill.style.marginTop = `${top}px`;
      pill.style.transform = `translateY(${liftPx}px) scale(${scale})`;
      pill.style.borderColor = lift && o < 0.5 ? "var(--foreground)" : "var(--border)";

      // shares the same 0.5 threshold as the `compact` state (which drives
      // these links' aria-hidden/tabIndex) so they can never be focusable
      // while still invisible, or visible while still unreachable
      if (links) links.style.opacity = o > 0.5 ? String((o - 0.5) / 0.5) : "0";
      if (hairline) {
        const t = sections.length > 1 ? activeIndex / (sections.length - 1) : 0;
        hairline.style.width = `${clamp01(t) * 100}%`;
        hairline.style.opacity = o < 0.5 ? "1" : "0";
      }
    },
    [activeIndex, sections.length]
  );

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    if (reduced) {
      // discrete: fully open at top, fully compact once scrolled, plain
      // opacity crossfade handled via the CSS classes below — still apply
      // the two static states directly so it's correct on first paint.
      // focus-forced expansion must also flip the discrete `compact` state
      // (not just the visual frame) — it's what makes the links reachable
      // at all, not just visible
      const y = window.scrollY;
      const isCompact = !focusExpanded && y > CLOSE_Y;
      setCompact(isCompact);
      applyFrame(isCompact ? 0 : 1, 0, focusExpanded, false);
      const onScroll = () => {
        const c = !focusExpanded && window.scrollY > CLOSE_Y;
        setCompact((prev) => (prev === c ? prev : c));
        applyFrame(c ? 0 : 1, 0, focusExpanded, false);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }

    lastYRef.current = window.scrollY;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const y = window.scrollY;
      const dy = y - lastYRef.current;
      lastYRef.current = y;

      // hysteresis banded target: only flips state at the far edge of the band
      let target = opennessRef.current > 0.5 ? (y > CLOSE_Y ? 0 : 1) : y < OPEN_Y ? 1 : 0;

      const fastFlick = dy < FLICK_DELTA;
      if (fastFlick) {
        target = 1;
        overshootUntilRef.current = now + OVERSHOOT_MS;
      }

      const inOvershoot = now < overshootUntilRef.current;
      const overshoot = inOvershoot
        ? Math.sin(((overshootUntilRef.current - now) / OVERSHOOT_MS) * Math.PI) * 0.6
        : 0;

      const rate = fastFlick ? LERP_RATE * 2.4 : LERP_RATE;
      opennessRef.current = lerp(opennessRef.current, target, 1 - Math.exp(-rate * dt));

      // focus-forced expansion must also flip the discrete `compact` state
      // (not just the visual frame) — it's what makes the links reachable
      // at all, not just visible
      const isCompact = !focusExpanded && opennessRef.current < 0.5;
      setCompact((prev) => (prev === isCompact ? prev : isCompact));

      applyFrame(opennessRef.current, overshoot, focusExpanded, hovered);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, focusExpanded, hovered, applyFrame]);

  // re-apply immediately on hover/focus toggles so it doesn't wait a frame
  useEffect(() => {
    if (reduced) {
      applyFrame(compact ? 0 : 1, 0, focusExpanded, hovered);
    }
  }, [hovered, focusExpanded, reduced, compact, applyFrame]);

  return (
    <header className={`fixed inset-x-0 top-0 z-40 flex justify-center ${className}`}>
      <div
        ref={pillRef}
        role="navigation"
        aria-label="Primary"
        tabIndex={-1}
        onFocus={() => setFocusExpanded(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusExpanded(false);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`relative flex items-center justify-between overflow-hidden border bg-background text-foreground transition-[background-color,border-color] duration-200 ${
          reduced ? "duration-150" : ""
        }`}
        style={{ borderColor: "var(--border)", willChange: "width, height, border-radius" }}
      >
        <a
          href="#top"
          className="shrink-0 whitespace-nowrap font-mono text-sm font-medium tracking-tight text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          {wordmark}
        </a>

        <div
          ref={barLinksRef}
          className="flex items-center gap-6 transition-opacity"
          aria-hidden={compact}
        >
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={s.id === active ? "location" : undefined}
              tabIndex={compact ? -1 : 0}
              className={`whitespace-nowrap text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent ${
                s.id === active ? "text-foreground" : "text-ns-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </a>
          ))}
        </div>

        {/* compact-state active-section label with a 1-line vertical roll */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
          aria-hidden="true"
          style={{ opacity: compact ? 1 : 0, transition: "opacity 200ms" }}
        >
          <span className="relative block h-4 overflow-hidden font-mono text-xs uppercase tracking-wide">
            <span ref={labelTrackRef} className="block">
              {sections[activeIndex]?.label ?? ""}
            </span>
          </span>
        </div>

        {/* progress hairline along the pill's bottom edge — a div, never svg
            dasharray (see project wiki: pathLength + non-scaling-stroke is
            broken in Chromium for exactly this kind of straight indicator) */}
        <div
          className="absolute inset-x-0 bottom-0 h-px"
          aria-hidden="true"
          style={{ background: "var(--border)" }}
        >
          <div
            ref={hairlineRef}
            className="h-full"
            style={{ background: "var(--foreground)", width: "0%" }}
          />
        </div>
      </div>
    </header>
  );
}
