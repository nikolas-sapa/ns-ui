"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * How often a scroll gesture may re-rank the mounted set. Bounded below by
 * "fast enough that a card inside the preload band is ranked before it
 * reaches the viewport" and above by "slow enough not to force a layout on
 * every frame Lenis eases".
 */
const SCROLL_RERANK_MS = 100;

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

  // `schedule` is rAF-throttled, which bounds it to once per frame — but
  // scroll FIRES every frame, because Lenis rewrites the scroll position on
  // every frame it is easing. So `recompute` ran every frame of every scroll,
  // reading getBoundingClientRect off every card inside the preload band
  // immediately after Lenis's own writes: a forced layout per frame, for the
  // whole gesture.
  //
  // The observers below still schedule immediately, so a card crossing the
  // preload boundary mounts on that same frame. This throttle only slows the
  // *re-ranking* that scroll alone drives, and the preload margin is exactly
  // the slack that makes that safe: a card has `preloadMargin` px of travel
  // before it genuinely needs to be mounted, which is hundreds of ms at any
  // real scroll speed. The other thing re-ranking feeds is the on-screen set
  // that pauses off-screen demos, where 100ms of latency is invisible.
  const scrollAt = useRef(0);
  const scrollTimer = useRef<number | null>(null);
  const scheduleFromScroll = useCallback(() => {
    const now = performance.now();
    const since = now - scrollAt.current;
    if (since >= SCROLL_RERANK_MS) {
      scrollAt.current = now;
      schedule();
      return;
    }
    // Trailing edge. A gesture can stop inside the throttle window, and the
    // resting position has to be ranked or a card sits mis-ranked until the
    // next scroll or intersection.
    if (scrollTimer.current !== null) return;
    scrollTimer.current = window.setTimeout(() => {
      scrollTimer.current = null;
      scrollAt.current = performance.now();
      schedule();
    }, SCROLL_RERANK_MS - since);
  }, [schedule]);

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
    // scroll too, throttled (see scheduleFromScroll). Resize stays immediate:
    // it is rare and it invalidates every rect at once.
    window.addEventListener("scroll", scheduleFromScroll, { passive: true });
    window.addEventListener("resize", schedule);
    for (const el of elements.current.values()) observer.current.observe(el);
    schedule();
    return () => {
      window.removeEventListener("scroll", scheduleFromScroll);
      window.removeEventListener("resize", schedule);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      if (scrollTimer.current !== null) clearTimeout(scrollTimer.current);
      scrollTimer.current = null;
      observer.current?.disconnect();
      observer.current = null;
    };
  }, [schedule, scheduleFromScroll]);

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
