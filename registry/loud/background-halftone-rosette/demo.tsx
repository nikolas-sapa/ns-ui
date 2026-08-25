"use client";

import { BackgroundHalftoneRosette } from "./component";

export default function BackgroundHalftoneRosetteDemo() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        <BackgroundHalftoneRosette />
      </div>
      {/* content sits toward the low-coverage edge zone the scrim protects,
          not over the dense rosette at the visual center */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-10 text-left">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / background-halftone-rosette
        </p>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground">
          Two screens, one ink
        </h1>
        <p className="max-w-sm text-sm text-ns-muted">
          Same-ink halftone screens drifting at independent angles — the moiré
          rosette is real dot-overlap interference, not a color trick.
        </p>
      </div>
    </div>
  );
}
