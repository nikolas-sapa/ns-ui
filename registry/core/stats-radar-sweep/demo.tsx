"use client";

import { ScanSweepStats } from "./component";

export default function ScanSweepStatsDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-3xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / stats-radar-sweep
        </p>
        <h1
          className="max-w-xl font-semibold text-foreground"
          style={{
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          Telemetry on a slow radar
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-ns-muted">
          The observatory logs each sensor once per revolution. A reading only
          lights up the moment the arm crosses it, then settles back into the
          noise floor until the next pass.
        </p>
        <ScanSweepStats className="mt-8" />
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          the arm sweeps once every 12s — hover or focus a card to replay its
          reading, click the pivot dot to pause the sweep
        </p>
      </div>
    </main>
  );
}
