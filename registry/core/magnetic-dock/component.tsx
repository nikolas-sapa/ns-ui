"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Gaussian-falloff magnification on a direct-DOM rAF loop — no React state
// on the hot path, interruptible easing on enter/leave.
export function MagneticDock({
  children,
  gain = 0.55,
  sigma = 80,
  lift = 16,
  className = "",
}: {
  children: ReactNode;
  /** max extra scale at zero distance (0.55 → 1.55x) */
  gain?: number;
  /** gaussian falloff radius in px */
  sigma?: number;
  /** upward shift in px at full magnification */
  lift?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const items = Array.from(container.children) as HTMLElement[];
    const scales = items.map(() => 1);
    let cursorX: number | null = null;
    let raf = 0;

    const loop = () => {
      let settled = true;
      // untransformed centers (offsetLeft ignores transforms — no feedback wobble)
      const left = container.getBoundingClientRect().left;
      const centers = items.map((el) => left + el.offsetLeft + el.offsetWidth / 2);
      items.forEach((el, i) => {
        let target = 1;
        if (cursorX !== null) {
          const d = cursorX - centers[i];
          target = 1 + gain * Math.exp(-(d * d) / (2 * sigma * sigma));
        }
        scales[i] += (target - scales[i]) * 0.18;
        if (Math.abs(target - scales[i]) > 0.002) settled = false;
      });
      items.forEach((el, i) => {
        // neighbors shove outward so grown items never overlap
        let shift = 0;
        for (let j = 0; j < items.length; j++) {
          if (j === i) continue;
          const push = (scales[j] - 1) * items[j].offsetWidth * 0.55;
          shift += j < i ? push : -push;
        }
        const s = scales[i];
        el.style.transform = `translate(${shift}px, ${-(s - 1) * lift}px) scale(${s})`;
      });
      raf = settled && cursorX === null ? 0 : requestAnimationFrame(loop);
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

    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
    };
  }, [gain, sigma, lift]);

  return (
    <div
      ref={containerRef}
      className={`flex items-end gap-2 [&>*]:origin-bottom [&>*]:will-change-transform ${className}`}
    >
      {children}
    </div>
  );
}
