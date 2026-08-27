"use client";

import { DividerMosaicSplit } from "./component";

export default function DividerMosaicSplitDemo() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-10 bg-background px-8 py-10">
      <div className="w-full max-w-3xl">
        <h2 className="mb-3 font-mono text-sm text-foreground">Section one</h2>
        <p className="mb-8 max-w-prose font-mono text-xs text-ns-muted">
          A page break rendered in NAPLPS separated mosaic mode — the same
          2x3 sextant sub-cell grid as a teletext alphamosaic, but every lit
          block sits inset from its neighbours by a real gap, so the band
          reads as small floating tiles rather than a solid shape.
        </p>
        <DividerMosaicSplit />
      </div>
      <div className="w-full max-w-3xl">
        <h2 className="mt-8 font-mono text-sm text-foreground">Section two</h2>
      </div>
    </div>
  );
}
