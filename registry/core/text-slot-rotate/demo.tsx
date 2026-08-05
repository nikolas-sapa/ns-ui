"use client";

import { SlotWordRotate } from "./component";

export default function SlotWordRotateDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / text-slot-rotate
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        <span>Built for</span>
        <SlotWordRotate
          words={["DESIGNERS", "ENGINEERS", "WRITERS", "FOUNDERS"]}
          className="rounded-sm border border-border bg-background px-3 py-1"
        />
      </div>

      <p className="max-w-md text-center font-mono text-xs text-ns-muted">
        hover to pause the reel, or step it manually with the arrows
      </p>
    </div>
  );
}
