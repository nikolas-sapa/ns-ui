"use client";

import { useEffect, useRef } from "react";

// Per-letter variable-font weight driven by cursor proximity.
// Geist Sans is a variable font, so style.fontWeight maps straight to wght.
// Direct-DOM rAF loop — no React state on the hot path.
export function DynamicWeightText({
  text,
  minWeight = 300,
  maxWeight = 800,
  sigma = 90,
  className = "",
}: {
  text: string;
  minWeight?: number;
  maxWeight?: number;
  /** gaussian falloff radius in px */
  sigma?: number;
  className?: string;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const letters = Array.from(root.children) as HTMLElement[];
    const weights = letters.map(() => minWeight);
    let cursorX: number | null = null;
    let raf = 0;

    const loop = () => {
      let settled = true;
      letters.forEach((el, i) => {
        let target = minWeight;
        if (cursorX !== null) {
          const r = el.getBoundingClientRect();
          const d = cursorX - (r.left + r.width / 2);
          target = minWeight + (maxWeight - minWeight) * Math.exp(-(d * d) / (2 * sigma * sigma));
        }
        weights[i] += (target - weights[i]) * 0.16;
        if (Math.abs(target - weights[i]) > 0.5) settled = false;
        el.style.fontWeight = String(Math.round(weights[i]));
      });
      // Park once weights converge — target only changes when cursorX moves
      // (or the pointer leaves), both of which call wake() below, so it's
      // safe to stop re-scheduling while the pointer sits still.
      raf = settled ? 0 : requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      cursorX = e.clientX;
      wake();
    };
    const onLeave = () => {
      cursorX = null;
      wake();
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [text, minWeight, maxWeight, sigma]);

  return (
    <span ref={rootRef} aria-label={text} role="text" className={className}>
      {Array.from(text).map((c, i) => (
        <span key={i} aria-hidden style={{ fontWeight: minWeight }}>
          {c === " " ? " " : c}
        </span>
      ))}
    </span>
  );
}
