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
  children,
}: {
  minWidth: number;
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
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

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
      className="inline-flex size-7 items-center justify-center rounded-sm text-ns-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-30"
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
