"use client";

import { FlagHoistRun } from "./component";

export default function FlagHoistRunDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / flag-hoist-run</p>

      <FlagHoistRun />

      <p className="max-w-md text-center text-xs text-ns-muted">
        Items entering a background pipeline: each one climbs the line, breaks out at the top to be
        processed, then clears fast to make room for the next.
      </p>
    </div>
  );
}
