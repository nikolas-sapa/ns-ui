"use client";

import { LloydRelax } from "./component";

export default function LloydRelaxDemo() {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0">
        {/* the catalog frame is 1440x900 scaled down — at the component's own
            default of 1400 sites the rest frame reads as faint scatter, so the
            demo runs a denser field where the stipple structure is legible */}
        <LloydRelax count={3600} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
        <p className="rounded-md border border-border bg-surface/80 px-4 py-2 font-mono text-xs text-ns-muted backdrop-blur-md">
          ns-ui / background-lloyd-relax — one Lloyd iteration per frame; the
          pointer opens a density well
        </p>
      </div>
    </div>
  );
}
