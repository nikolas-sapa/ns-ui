"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Wraps the release strand's horizontally-scrolling track (it has to be
 * wide enough that 18+ release labels don't overprint each other — see the
 * comment in page.tsx) with real on-screen prev/next buttons.
 *
 * `timeline-changelog-wave` (registry/) already draws its own scrub
 * controls, but they're laid out at the far right edge of that same wide
 * track — off past the visible width at every size that matters here, so a
 * visitor never scrolls that far to find them. Nothing under registry/ gets
 * touched to fix that; instead this renders independent buttons here, using
 * the site's own chevron (same path as the Sort select and the changelog's
 * own per-entry nav arrows), that pan the track itself. The caption below
 * this component used to promise arrows that didn't exist on screen — it
 * does now.
 */
export function TimelineScrub({
  minWidth,
  eventCount,
  children,
}: {
  minWidth: number;
  /** events fed to Strandline — sizes how long its intro tide runs so the
   *  auto-scroll (below) doesn't ease back to the resting position before
   *  the tide has actually reached it */
  eventCount: number;
  children: React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => {
      setAtStart(el.scrollLeft <= 1);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);

    // Strandline's intro tide always enters from its own right edge (the
    // "now" side) and washes toward each target — but this track's resting
    // scroll position is the left edge (newest releases, see page.tsx). With
    // a history wider than the viewport that leaves the entire tide, and the
    // first several deposits, scrolled off past the right edge: a visitor
    // landing during the ~8s intro sees an empty strip. Start scrolled to
    // the "now" edge so the tide is visible as it sweeps in, then ease back
    // to the documented resting position (newest-first, left-anchored) once
    // it's had a moment to play. Any real user input cancels the auto-scroll
    // outright — it must never fight a scroll/keyboard/touch interaction.
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    let cancelled = reduced;
    const cancel = () => {
      cancelled = true;
    };
    if (!cancelled && el.scrollWidth > el.clientWidth) {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
      el.addEventListener("pointerdown", cancel, { once: true });
      el.addEventListener("wheel", cancel, { once: true, passive: true });
      el.addEventListener("keydown", cancel, { once: true });
      el.addEventListener("touchstart", cancel, {
        once: true,
        passive: true,
      });
      // Strandline stages one wave per event every 160ms (its
      // LAUNCH_STAGGER_MS) and the last-launched wave still has to travel
      // its full arc (~its width / 420px/s) plus a 550ms recede — for this
      // page's 20+ releases that's several seconds. Easing the camera back
      // on a fixed short delay reliably beat the tide here, landing on the
      // resting position before it had drawn anything there. Size the
      // delay off the actual event count instead of a guess.
      const settle = window.setTimeout(
        () => {
          if (!cancelled) {
            el.scrollTo({ left: 0, behavior: "smooth" });
          }
        },
        eventCount * 160 + 4000
      );
      return () => {
        window.clearTimeout(settle);
        el.removeEventListener("scroll", update);
        el.removeEventListener("pointerdown", cancel);
        el.removeEventListener("wheel", cancel);
        el.removeEventListener("keydown", cancel);
        el.removeEventListener("touchstart", cancel);
        ro.disconnect();
      };
    }

    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [eventCount]);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({
      left: dir * Math.min(el.clientWidth * 0.8, 320),
      behavior: reduced ? "auto" : "smooth",
    });
  };

  return (
    <div>
      <div className="flex items-center justify-end gap-1">
        <ScrubArrow direction="prev" disabled={atStart} onClick={() => scrollBy(-1)} />
        <ScrubArrow direction="next" disabled={atEnd} onClick={() => scrollBy(1)} />
      </div>
      <div
        ref={trackRef}
        tabIndex={0}
        role="group"
        aria-label="Release timeline, scrollable — use the arrow keys or the buttons above to scrub"
        className="-mx-1 mt-1 overflow-x-auto px-1 outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
      >
        <div style={{ minWidth: `${minWidth}px` }}>{children}</div>
      </div>
    </div>
  );
}

function ScrubArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const label = direction === "prev" ? "Scrub timeline earlier" : "Scrub timeline later";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={onClick}
      // Capped at half the 4px gap to its sibling arrow; generous vertically
      // (isolated row, nothing above/below at that distance) — 28x28 -> ~32x40.
      className="relative inline-flex size-7 items-center justify-center rounded-sm text-ns-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-30 after:absolute after:-inset-x-[2px] after:-inset-y-[6px] after:content-['']"
    >
      {/* Same hand-drawn chevron the Sort select and the sidebar's <details>
          use, rotated to point left/right instead of redrawn. */}
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className={`size-3 ${direction === "prev" ? "rotate-90" : "-rotate-90"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>
  );
}
