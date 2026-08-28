"use client";

import { LapStrokeTrace } from "./component";

export default function LapStrokeTraceDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / lap-stroke-trace</p>

      <LapStrokeTrace />

      <p className="max-w-md text-center text-xs text-ns-muted">
        A pitch lap traces an unrepeating golden-ratio stroke across the blank. Hover the disc to
        dwell over one arc.
      </p>
    </div>
  );
}
