"use client";

import { useMemo } from "react";
import { TideLedger, type TideCell } from "./component";

// Deterministic sample data — a seeded LCG, not Math.random, so the screenshot
// gate compares like with like on every run.
function series(n: number): TideCell[] {
  let seed = 20260731;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const start = Date.UTC(2026, 0, 5);
  return Array.from({ length: n }, (_, i) => {
    const weekday = i % 7;
    // weekends run slack, and a slow swell rides under the whole series
    const swell = 0.45 + 0.55 * Math.sin((i / n) * Math.PI * 1.6);
    const weekend = weekday > 4 ? 0.25 : 1;
    const v = Math.round(rand() * 14 * swell * weekend);
    return {
      date: new Date(start + i * 86400000).toISOString().slice(0, 10),
      value: rand() > 0.93 ? 0 : v,
    };
  });
}

export default function TideLedgerDemo() {
  const data = useMemo(() => series(26 * 7), []);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / heatmap-calendar-tide</p>
      <TideLedger data={data} label="Commits per day" />
      <p className="max-w-md text-center text-xs text-ns-muted">
        One hue, five depths, mixed from the accent token into the background — so the ramp is
        re-stepped by the theme rather than flipped. Hover or arrow through the grid; the caption is
        the only readout.
      </p>
    </div>
  );
}
