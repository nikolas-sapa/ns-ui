"use client";

import { FlamegraphAsciiFrames } from "./component";

export default function FlamegraphAsciiFramesDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / flamegraph-ascii-frames
      </p>

      <div className="w-full max-w-[900px] rounded-[12px] border border-border bg-background p-6">
        <div className="mb-4 flex items-baseline justify-between font-mono text-[11px]">
          <span className="text-foreground">api-gateway — CPU profile</span>
          <span className="text-ns-muted">1&nbsp;kHz sampling · 3.1 s wall</span>
        </div>
        <FlamegraphAsciiFrames />
      </div>

      <p className="max-w-lg text-center text-xs text-ns-muted">
        Row = stack depth, width = sample count, ink weight = share of time spent in the frame
        itself. Click a frame to zoom into its subtree; the breadcrumb or Escape pops back out.
      </p>
    </div>
  );
}
