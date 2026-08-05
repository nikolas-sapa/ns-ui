"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect } from "react";

/**
 * Eased wheel/trackpad scrolling for the whole document. Ported from the
 * portfolio's `SmoothScroll`, adapted from its container-scroll setup
 * (a fixed-height "Finder window" wraps a wrapper/content ref pair) to
 * window-scroll: ns-ui has no such container, the page itself scrolls.
 * Same config values as the source (duration, media gates) — only the
 * wrapper/content target changed.
 */
export function SmoothScroll() {
  useEffect(() => {
    // Every /preview/<slug> shape (bare fixture + /embed) and every catalog
    // card thumbnail render this same root layout inside an <iframe> — Lenis
    // must never attach there, or it fights each embedded component's own
    // scroll/drag behavior from inside its own document.
    if (window.self !== window.top) return;

    // Mobile scrolls the whole page natively — nothing to ease here.
    if (!window.matchMedia("(min-width: 640px)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 0.9,
      autoRaf: false,
    });

    let frame = requestAnimationFrame(function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    });

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
