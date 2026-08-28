"use client";

import { HoneycombDraw } from "./component";

export default function HoneycombDrawDemo() {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0">
        <HoneycombDraw />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
        <p className="rounded-md border border-border bg-surface/80 px-4 py-2 font-mono text-xs text-ns-muted backdrop-blur-md">
          ns-ui / honeycomb-draw — packed circles relax wall by wall into a
          hexagonal comb as new cells seed in from the left
        </p>
      </div>
    </div>
  );
}
