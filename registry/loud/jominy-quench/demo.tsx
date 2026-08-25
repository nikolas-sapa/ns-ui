"use client";

import { JominyQuench } from "./component";

export default function JominyQuenchDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-2xl">
        <p className="mb-10 text-center font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / jominy-quench
        </p>
        <div className="mx-auto mb-10 max-w-xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Which grade hardens harder, deeper
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ns-muted">
            One face of each bar is water-quenched; hardness falls off with
            distance from that face along a curve unique to the alloy —
            the standard ASTM A255 Jominy end-quench test, run side by side.
          </p>
        </div>
        <JominyQuench title="Hardenability by grade" />
        <p className="mt-10 text-center font-mono text-[11px] text-ns-muted">
          Hover or focus a grade to trace its curve.
        </p>
      </div>
    </main>
  );
}
