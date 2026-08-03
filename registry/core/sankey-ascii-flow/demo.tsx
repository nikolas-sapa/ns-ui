"use client";

import { AsciiSankeyFlow } from "./component";

export default function AsciiSankeyFlowDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / sankey-ascii-flow
      </p>

      <div className="inline-block rounded-[12px] border border-border bg-background p-6">
        <AsciiSankeyFlow />
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Click a node to isolate its upstream and downstream flow — the
        surviving bands re-weight to fill the space, not just dim the rest.
      </p>
    </div>
  );
}
