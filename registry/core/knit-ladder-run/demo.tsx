"use client";

import { KnitLadderRun } from "./component";

export default function KnitLadderRunDemo() {
  return (
    <div
      data-knit-ladder-card
      className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16"
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / knit-ladder-run
      </p>

      <div className="h-72 w-full max-w-sm overflow-hidden rounded-[16px] border border-border bg-background">
        <KnitLadderRun />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        A knit fabric builds course by course; every so often a dropped stitch opens a ladder that
        a latch-hook repair reknits from the bottom up — structurally sound, with occasional
        self-corrected faults.
      </p>
    </div>
  );
}
