"use client";

import { useEffect, useRef, type ReactNode } from "react";

// A page rides on its footer the way a wall rides its footing course: the
// footer never moves, the sheet of content slides off it.
//
// The reveal itself is free — `position: sticky; bottom: 0` pins the footer to
// the bottom of whatever scroller it lives in from the first paint, and the
// opaque content sheet above it (z-10) is the only thing hiding it. Scrolling
// to the end slides that sheet off. No fixed positioning, no clip path, no
// height animated against scroll offset; scroll is read only to lag the
// footer's own content behind its exposure.
export function FootingCourse({
  footer,
  children,
  parallax = 24,
  className = "",
}: {
  footer: ReactNode;
  children: ReactNode;
  /** px the footer's content lags behind its own reveal — 0 disables the lag */
  parallax?: number;
  className?: string;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sheet = sheetRef.current;
    const foot = footRef.current;
    const inner = innerRef.current;
    if (!sheet || !foot || !inner) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let height = 0;
    let raf = 0;

    const update = () => {
      raf = 0;
      if (!height) return;
      // Exposure measured between two rects, never against window.innerHeight —
      // the component has to survive living inside a scroll container, not just
      // the document.
      const exposed = Math.min(
        Math.max(foot.getBoundingClientRect().bottom - sheet.getBoundingClientRect().bottom, 0),
        height,
      );
      const ratio = exposed / height;
      foot.style.setProperty("--footing-reveal", ratio.toFixed(3));
      inner.style.transform = reduce.matches
        ? ""
        : `translate3d(0, ${((1 - ratio) * parallax).toFixed(1)}px, 0)`;
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    // The footer's height is not knowable at author time — responsive columns
    // and long link lists change it, and so does font loading — so the reveal
    // ratio is measured against the observed height, never a constant.
    const ro = new ResizeObserver(() => {
      height = foot.offsetHeight;
      update();
    });
    ro.observe(foot);

    // Focus entering a still-covered footer is the one real hazard in this
    // pattern: the footer is pinned inside the viewport, so the browser sees no
    // reason to scroll it into view, and the ring paints underneath the opaque
    // sheet. Uncover it ourselves when focus arrives from the keyboard.
    const scrollParent = (el: HTMLElement): Element => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const oy = getComputedStyle(p).overflowY;
        if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
      }
      return document.scrollingElement ?? document.documentElement;
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !foot.contains(target)) return;
      const exposed = foot.getBoundingClientRect().bottom - sheet.getBoundingClientRect().bottom;
      if (exposed >= height) return;
      scrollParent(foot).scrollBy({
        top: height - Math.max(exposed, 0),
        behavior: reduce.matches ? "auto" : "smooth",
      });
    };
    foot.addEventListener("focusin", onFocusIn);

    // capture: a nested scroller's scroll event does not bubble to window.
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll, { passive: true });
    reduce.addEventListener("change", update);
    update();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      foot.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
      reduce.removeEventListener("change", update);
    };
  }, [parallax]);

  return (
    <div className={["relative", className].join(" ")}>
      {/* opaque sheet — it is what hides the footer until the end */}
      <div ref={sheetRef} className="relative z-10 bg-background">
        {children}
      </div>
      <footer
        ref={footRef}
        className="sticky bottom-0 z-0 overflow-hidden border-t border-border bg-background text-foreground"
      >
        <div ref={innerRef} className="will-change-transform">
          {footer}
        </div>
      </footer>
    </div>
  );
}
