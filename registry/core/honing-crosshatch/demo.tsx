"use client";

import { HoningCrosshatch } from "./component";

export default function HoningCrosshatchDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / honing-crosshatch</p>

      <HoningCrosshatch />

      <p className="max-w-md text-center text-xs text-ns-muted">
        Two scratch families continuously turn over at a fixed 45 degree crosshatch, density held
        steady. Hover the card to dwell the stone over one spot.
      </p>
    </div>
  );
}
