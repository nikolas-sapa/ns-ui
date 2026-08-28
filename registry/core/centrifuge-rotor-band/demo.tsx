"use client";

import { CentrifugeRotorBand } from "./component";

export default function CentrifugeRotorBandDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / centrifuge-rotor-band
        </p>
        <h1 className="text-lg font-semibold text-foreground">Preparing sample</h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          A spin-up, hold, and brake cycle instead of a spinner — the rotor's
          own blurred ring sits in the background while four density bands
          drift outward along the sample tube during every 8s hold, then
          reload for the next run.
        </p>

        <div className="mt-5 rounded-md border border-border bg-surface p-5">
          <CentrifugeRotorBand label="Preparing sample" />
        </div>
      </div>
    </main>
  );
}
