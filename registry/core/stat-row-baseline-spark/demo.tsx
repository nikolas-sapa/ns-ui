"use client";

import { StatTileRow, type StatTileData } from "./component";

const TILES: StatTileData[] = [
  {
    id: "revenue",
    label: "Revenue",
    value: 128400,
    unit: "$",
    precision: 0,
    history: [98200, 101300, 104800, 109500, 112100, 118700, 121900, 125300, 126800, 127200, 127900],
    baselineIndex: 0,
    baselineLabel: "30d ago",
    polarity: "higherIsBetter",
  },
  {
    id: "latency",
    label: "P95 Latency",
    value: 142,
    unit: "ms",
    precision: 0,
    history: [210, 198, 205, 189, 176, 168, 171, 159, 152, 148, 150],
    baselineIndex: 0,
    baselineLabel: "30d ago",
    polarity: "lowerIsBetter",
  },
  {
    id: "errors",
    label: "Error Rate",
    value: 0.42,
    unit: "%",
    precision: 2,
    history: [0.31, 0.29, 0.33, 0.3, 0.28, 0.35, 0.31, 0.3, 0.34, 0.36, 0.39],
    baselineIndex: 0,
    baselineLabel: "30d ago",
    polarity: "lowerIsBetter",
  },
  {
    id: "users",
    label: "Active Users",
    value: 8412,
    precision: 0,
    history: [7120, 7340, 7480, 7690, 7810, 7990, 8050, 8190, 8260, 8330, 8370],
    baselineIndex: 0,
    baselineLabel: "30d ago",
    polarity: "higherIsBetter",
  },
];

export default function StatTileRowDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">ns-ui / stat-row-baseline-spark</p>
        <div data-frame="stat-row" className="rounded-md border border-border bg-background p-5">
          <StatTileRow tiles={TILES} />
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          hover or tab to a tile to see exactly where its baseline sits on the sparkline — the delta
          always states what it&apos;s measured against, and latency&apos;s fall reads as good news here
          precisely because a fall is what &quot;lower is better&quot; means for it, not because down is
          colored green
        </p>
      </div>
    </main>
  );
}
