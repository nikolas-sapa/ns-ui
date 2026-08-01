"use client";

import { ChartBarHalftone } from "./component";

const DATA = [
  { label: "Mon", value: 420 },
  { label: "Tue", value: 680 },
  { label: "Wed", value: 512 },
  { label: "Thu", value: 940 },
  { label: "Fri", value: 1180 },
  { label: "Sat", value: 760 },
  { label: "Sun", value: 340 },
];

export default function ChartBarHalftoneDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / chart-bar-halftone
        </p>
        <div className="rounded-md border border-border bg-surface p-5">
          <ChartBarHalftone data={DATA} title="Weekly signups" />
        </div>
      </div>
    </main>
  );
}
