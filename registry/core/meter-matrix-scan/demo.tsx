"use client";

import { MeterMatrixScan } from "./component";

export default function MeterMatrixScanDemo() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-8 bg-background px-8 py-10">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / meter-matrix-scan
        </p>
        <h2 className="mb-2 text-base font-semibold text-foreground">
          Sensor read
        </h2>
        <p className="mb-6 max-w-prose text-sm leading-relaxed text-ns-muted">
          A level meter rendered as a real row-multiplexed LED dot-matrix
          panel — five rows scanning at 240Hz per row, each LED's brightness
          set by an 8-step PWM duty cycle rather than a smooth fill.
        </p>
        <div className="rounded-md border border-border bg-surface p-5">
          <MeterMatrixScan label="System load" />
        </div>
      </div>
      <div className="w-full max-w-md">
        <div className="rounded-md border border-border bg-surface p-5">
          <MeterMatrixScan label="Fixed reading" value={72} />
        </div>
      </div>
    </div>
  );
}
