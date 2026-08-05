"use client";

import { ChartLineDither } from "./component";

const DATA = [
  { label: "Jan", value: 220 },
  { label: "Feb", value: 340 },
  { label: "Mar", value: 300 },
  { label: "Apr", value: 480 },
  { label: "May", value: 610 },
  { label: "Jun", value: 560 },
  { label: "Jul", value: 720 },
  { label: "Aug", value: 690 },
  { label: "Sep", value: 810 },
];

export default function ChartLineDitherDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / chart-line-dither
        </p>
        <div className="rounded-md border border-border bg-surface p-5">
          <ChartLineDither data={DATA} title="MRR growth" />
        </div>
      </div>
    </main>
  );
}
