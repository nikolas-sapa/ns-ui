"use client";

import { GitGraphAsciiLanes } from "./component";

export default function GitGraphAsciiLanesDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / git-graph-ascii-lanes</p>

      <div className="w-full max-w-2xl rounded-[12px] border border-border bg-background px-5 py-4">
        <div className="mb-3 flex items-baseline justify-between border-b border-border pb-2 font-mono text-[11px]">
          <span className="text-ns-muted">ns-ui/registry</span>
          <span className="text-ns-accent">HEAD → main</span>
        </div>
        <GitGraphAsciiLanes />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Hover or arrow-key a commit to light its ancestors through the lanes. Enter on a merge (◍) collapses its side
        branch and the braid straightens.
      </p>
    </div>
  );
}
