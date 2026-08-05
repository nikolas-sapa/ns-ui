"use client";

import { SpectrogramAsciiBands } from "./component";

export default function SpectrogramAsciiBandsDemo() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-8 py-10">
      <div className="w-full">
        <div className="mb-4 flex items-baseline justify-between gap-4 font-mono">
          <h2 className="text-sm text-foreground">Room mic — channel A</h2>
          <span className="text-xs text-ns-muted">
            16 kHz · 512-pt FFT · 32 log bands · 50 ms hop
          </span>
        </div>
        <SpectrogramAsciiBands />
        <p className="mt-3 font-mono text-xs text-ns-muted">
          Time runs right to left; the newest column is at the right edge.
        </p>
      </div>
    </div>
  );
}
