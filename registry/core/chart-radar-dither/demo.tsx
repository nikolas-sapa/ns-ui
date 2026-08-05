"use client";

import { ChartRadarDither } from "./component";

const DATA = [
  { label: "Speed", value: 78 },
  { label: "Range", value: 62 },
  { label: "Comfort", value: 85 },
  { label: "Price", value: 40 },
  { label: "Safety", value: 91 },
  { label: "Tech", value: 70 },
];

export default function ChartRadarDitherDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / chart-radar-dither
        </p>
        <div className="rounded-md border border-border bg-surface p-5">
          <ChartRadarDither data={DATA} title="Model comparison" />
        </div>
      </div>
    </main>
  );
}
