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

    let items: HTMLElement[] = [];
    let scales: number[] = [];
    let cursorX: number | null = null;
    let raf = 0;

    // re-sync from the live DOM whenever children are added/removed/reordered
    // — keeps the loop from animating a stale snapshot (and stale detached nodes).
    const sync = () => {
      const next = Array.from(container.children) as HTMLElement[];
      scales = next.map((el) => {
        const i = items.indexOf(el);
        return i === -1 ? 1 : scales[i];
      });
      items = next;
    };
    sync();

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
        // magnification amount 0..1 — sells depth beyond scale/lift alone,
        // color-mix(currentColor) so the glow adapts to each theme automatically.
        const t = Math.max(0, (s - 1) / gain);
        if (t > 0.002) {
          el.style.filter = `brightness(${1 + t * 0.12})`;
          el.style.boxShadow = `0 ${4 + t * 10}px ${10 + t * 16}px -4px color-mix(in srgb, currentColor ${Math.round(15 + t * 25)}%, transparent)`;
        } else {
          el.style.filter = "";
          el.style.boxShadow = "";
        }
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

    const observer = new MutationObserver(() => {
      sync();
      wake();
    });
    observer.observe(container, { childList: true });

    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
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
