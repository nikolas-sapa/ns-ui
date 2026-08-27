"use client";

import { GravureCellWipe } from "./component";

export default function GravureCellWipeDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / gravure-cell-wipe</p>

      <div className="w-full max-w-2xl">
        <GravureCellWipe />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Watch the band sweep left to right: cells ahead sit in the raw, unwiped flood, cells just
        behind the blade flash brighter for a moment before settling. Hover to peek more ink.
      </p>
    </div>
  );
}
