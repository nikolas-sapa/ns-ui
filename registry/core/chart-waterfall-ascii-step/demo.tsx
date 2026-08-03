"use client";

import { ChartWaterfallAsciiStep } from "./component";

export default function ChartWaterfallAsciiStepDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / chart-waterfall-ascii-step
        </p>
        <div className="rounded-md border border-border bg-surface p-5">
          <ChartWaterfallAsciiStep title="Synthetic MRR bridge" />
        </div>
      </div>
    </main>
  );
}
