"use client";

import { DividerTeletextMosaic } from "./component";

export default function DividerTeletextMosaicDemo() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-10 bg-background px-8 py-10">
      <div className="w-full max-w-3xl">
        <h2 className="mb-3 font-mono text-sm text-foreground">Section one</h2>
        <p className="mb-8 max-w-prose font-mono text-xs text-ns-muted">
          A page break rendered as a teletext alphamosaic band — a 6-bit,
          2x3 sextant grid per cell, painted row by row the way a real
          teletext page arrives off the broadcast signal.
        </p>
        <DividerTeletextMosaic />
      </div>
      <div className="w-full max-w-3xl">
        <h2 className="mt-8 font-mono text-sm text-foreground">Section two</h2>
      </div>
    </div>
  );
}
