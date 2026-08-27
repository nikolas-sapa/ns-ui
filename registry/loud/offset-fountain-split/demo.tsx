"use client";

import { OffsetFountainSplit } from "./component";

// Full-viewport background. Purely ambient — the ink-train field drifts on
// its own clock, never converging flat, with no synthetic input required to
// demonstrate it.
export default function OffsetFountainSplitDemo() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <div data-offset-fountain-split-stage className="absolute inset-0">
        <OffsetFountainSplit />
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
        <div className="flex flex-col items-center gap-3 rounded-lg bg-background/40 px-8 py-6 backdrop-blur-md">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
            ns-ui / offset-fountain-split
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            An ink train that never sits still
          </h1>
        </div>
      </div>
    </div>
  );
}
