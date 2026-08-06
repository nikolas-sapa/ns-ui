"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Decides which cards may run a live preview iframe.
 *
 * Rule: any card touching the real viewport is never evicted (evicting a
 * visible card would blank it mid-scroll). The cap only sheds cards that are
 * entirely off-screen, nearest-to-viewport first.
 *
 * Factored out of `showcase.tsx` so `saved-library.tsx` shares the exact
 * same eviction rule instead of a second, drifting one — a saved library can
 * hold many items and each preview is an iframe, so mounting them all
 * eagerly is the same cost problem the homepage catalog already solved.
 */
export function useMountManager({
  mountCap,
  preloadMargin,
}: {
  /** How many demos may run at once. */
  mountCap: number;
  /** Mount a demo this far outside the viewport so it has run a beat before seen. */
  preloadMargin: number;
}) {
  const elements = useRef(new Map<string, HTMLElement>());
  const near = useRef(new Set<string>());
  const frame = useRef<number | null>(null);
  const [mounted, setMounted] = useState<Set<string>>(() => new Set());
  // The subset of `mounted` that is actually inside the true viewport (no
  // preload margin) — the same rects `recompute` already computes to decide
  // eviction order, just kept around instead of thrown away. This is what a
  // mounted-but-off-screen preview (e.g. a preload card just past the fold)
  // is paused against — see `LivePreviewFrame`'s visibility postMessage.
  const [onScreen, setOnScreen] = useState<Set<string>>(() => new Set());
  const observer = useRef<IntersectionObserver | null>(null);

  const recompute = useCallback(() => {
    frame.current = null;
    const vh = window.innerHeight;
    const onScreenNames: string[] = [];
    const offScreen: { name: string; dist: number }[] = [];

    for (const name of near.current) {
      const el = elements.current.get(name);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        onScreenNames.push(name);
      } else {
        const centre = (r.top + r.bottom) / 2;
        offScreen.push({ name, dist: Math.abs(centre - vh / 2) });
      }
    }

    const next = new Set(onScreenNames);
    offScreen.sort((a, b) => a.dist - b.dist);
    for (const o of offScreen) {
      if (next.size >= mountCap) break;
      next.add(o.name);
    }

    setMounted((prev) => {
      if (prev.size === next.size && [...next].every((n) => prev.has(n))) {
        return prev;
      }
      return next;
    });

    const nextOnScreen = new Set(onScreenNames);
    setOnScreen((prev) => {
      if (prev.size === nextOnScreen.size && [...nextOnScreen].every((n) => prev.has(n))) {
        return prev;
      }
      return nextOnScreen;
    });
  }, [mountCap]);

  const schedule = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(recompute);
  }, [recompute]);

  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const name = (e.target as HTMLElement).dataset.name;
          if (!name) continue;
          if (e.isIntersecting) near.current.add(name);
          else near.current.delete(name);
        }
        schedule();
      },
      { rootMargin: `${preloadMargin}px 0px ${preloadMargin}px 0px` },
    );
    // A card can cross the true viewport edge while staying inside the
    // preload margin, which fires no intersection callback — so re-rank on
    // scroll too (rAF-throttled, reading only the handful of near cards).
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    for (const el of elements.current.values()) observer.current.observe(el);
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      observer.current?.disconnect();
      observer.current = null;
    };
  }, [schedule]);

  const registerRef = useCallback(
    (name: string, el: HTMLElement | null) => {
      const prev = elements.current.get(name);
      if (prev && prev !== el) {
        observer.current?.unobserve(prev);
        elements.current.delete(name);
        near.current.delete(name);
      }
      if (el) {
        elements.current.set(name, el);
        observer.current?.observe(el);
      }
      schedule();
    },
    [schedule],
  );

  const isActive = useCallback((name: string) => mounted.has(name), [mounted]);
  const isOnScreen = useCallback((name: string) => onScreen.has(name), [onScreen]);

  return { registerRef, isActive, isOnScreen };
}
