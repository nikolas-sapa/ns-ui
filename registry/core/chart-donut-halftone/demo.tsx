"use client";

import { ChartDonutHalftone } from "./component";

// ordinal, low -> high: size tier order carries meaning, so tier position
// (not share) is what the ink density encodes
const DATA = [
  { label: "S", value: 320 },
  { label: "M", value: 540 },
  { label: "L", value: 410 },
  { label: "XL", value: 180 },
];

export default function ChartDonutHalftoneDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / chart-donut-halftone
        </p>
        <div className="rounded-md border border-border bg-surface p-6">
          <ChartDonutHalftone data={DATA} title="Orders by size" unit="orders" />
        </div>
      </div>
    </main>
  );
}
