"use client";

import { useEffect, useRef } from "react";
import { StippleYear } from "./component";

// Deterministic sample data (never Math.random() — this renders on the
// server too, and a random value there would mismatch the client's on
// hydration). A small local hash/PRNG, seeded per date, mixes a weekly
// rhythm (heavier midweek) with a seasonal bump so the year reads as
// plausible activity rather than uniform noise.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

// Local calendar date, not UTC — must match the component's own key format
// exactly (toISOString() shifts to UTC and can land on the wrong day).
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sampleValues(end: Date): Record<string, number> {
  const values: Record<string, number> = {};
  for (let i = 0; i < 365; i++) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const iso = isoDate(d);
    const weekday = d.getDay();
    const weekdayBoost = weekday === 0 || weekday === 6 ? 0.3 : 1;
    const seasonal = 0.5 + 0.5 * Math.sin((d.getMonth() / 12) * Math.PI * 2);
    const noise = hash(iso);
    const raw = noise * 10 * weekdayBoost * (0.5 + seasonal);
    values[iso] = noise < 0.12 ? 0 : Math.round(raw);
  }
  return values;
}

// Fixed reference date — deterministic across server and client renders.
const END_DATE = new Date(2026, 6, 22);

export default function StippleYearDemo() {
  const values = sampleValues(END_DATE);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Self-driving: periodically move focus across a few cells so the loupe
  // and focus ring are visible mid-interaction, not just on a static frame.
  // Paused while a real pointer is resting inside the component — otherwise
  // the synthetic focus() steals hoverIndex out from under a genuine hover
  // (via the cell's own onFocus handler) and the loupe appears to jump to an
  // unrelated day a second and a half later.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let pointerInside = false;
    const onEnter = () => {
      pointerInside = true;
    };
    const onLeave = () => {
      pointerInside = false;
    };
    root.addEventListener("pointerenter", onEnter);
    root.addEventListener("pointerleave", onLeave);

    const cells = () => Array.from(root.querySelectorAll<HTMLElement>('[role="button"]'));
    let i = 0;
    const id = setInterval(() => {
      if (pointerInside) return;
      const list = cells();
      if (!list.length) return;
      const target = list[Math.floor((i * 37) % list.length)];
      target?.focus();
      i += 1;
    }, 1500);
    return () => {
      clearInterval(id);
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={rootRef} className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / heatmap-year-stipple
      </p>

      <div className="inline-block rounded-[12px] border border-border bg-background p-6">
        <StippleYear values={values} endDate={END_DATE} />
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Density is stippled ink, not color. Hover or arrow-key through days
        for the loupe and exact count.
      </p>
    </div>
  );
}
