"use client";

import { BiasHysteresis } from "./component";

export default function BiasHysteresisDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / bias-hysteresis
        </p>
        <h1 className="text-lg font-semibold text-foreground">Master bus saturation</h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          A closed loop instead of a bar — the tape's own magnetic memory of
          the signal driving it. Corners sharpen at low drive, round off
          toward saturation at high drive, and the loop's own width breathes
          on a slower cycle independent of the marker's lap.
        </p>

        <div className="mt-5 rounded-md border border-border bg-surface p-5">
          <BiasHysteresis label="Master bus drive" />
        </div>
      </div>
    </main>
  );
}
