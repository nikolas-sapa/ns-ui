"use client";

import { LiquidCollar } from "./component";

// Self-driving: the liquid band animates on its own (no rAF-only-on-hover
// gating), so the demo needs no synthetic input to prove it's alive.
export default function LiquidCollarDemo() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-12 bg-background px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          ns-ui / liquid-collar
        </p>
        <p className="text-xs text-muted">A rounded-rect and a circle, each wrapped in a liquid metal band.</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-10">
        <LiquidCollar variant="pill" ringWidth={6} className="card-focus">
          <button className="rounded-md bg-surface px-6 py-3 text-sm font-medium text-foreground">
            Continue
          </button>
        </LiquidCollar>
        <LiquidCollar variant="circle" ringWidth={5}>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-sm font-medium text-foreground">
            AB
          </div>
        </LiquidCollar>
      </div>
    </div>
  );
}
