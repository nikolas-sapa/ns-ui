"use client";

import { AsciiFlowDiagram } from "./component";

export default function AsciiFlowDiagramDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / diagram-ascii-flow
      </p>

      <div className="inline-block rounded-[12px] border border-border bg-background p-6">
        <AsciiFlowDiagram />
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Drag a node (or focus it and use arrow keys) — every connector
        re-routes live. Click a node to inspect its connections.
      </p>
    </div>
  );
}
