"use client";

import { DifferentialAnalyserTrace } from "./component";

export default function DifferentialAnalyserTraceDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / differential-analyser-trace
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          The wheel never stops integrating
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          A friction wheel rides a steadily spinning disc at a wandering
          radius; the trace beside it is the running total of wherever the
          wheel has been.
        </p>
        <div className="mt-5 overflow-hidden rounded-md border border-border bg-surface p-5">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <span className="font-mono text-[11px] tracking-widest text-ns-muted">
              THROUGHPUT
            </span>
            <span className="font-mono text-sm tabular-nums text-foreground">
              integrator live
            </span>
          </div>
          <div className="h-[220px] w-full">
            <DifferentialAnalyserTrace />
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          disc spins at a constant 0.5 rev/s — the wheel's radius is the only
          thing that moves
        </p>
      </div>
    </main>
  );
}
