"use client";

import { useState } from "react";
import { PeckedRing } from "./component";

// Two scales of the same instrument. The left one is a normal street-level
// map (metersPerPixel 20) — dashes stay comfortably legible the whole
// range, and dragging the handle outward visibly grows the dash count.
// The right one is zoomed way out (metersPerPixel 60): per-dash spacing
// would fall under 3px, so it switches to ten-dash bundles (1km per dash)
// instead of drawing a denser pattern that would just blur into a solid
// ring — same governing rule, same falsifiable-by-eye radius, coarser unit.
export default function PeckedRingDemo() {
  const [radius, setRadius] = useState(1400);
  const [wide, setWide] = useState(5000);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background p-6 sm:flex-row">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / pecked-ring
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          Drag the handle to set the radius
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          Every dash is exactly 100m of ground — count them and you have the
          radius, no legend required. Crossing a dash boundary re-spaces the
          whole ring over 120ms so it never shimmers.
        </p>
        <div className="mt-5">
          <PeckedRing
            id="pecked-ring-primary"
            label="Alert radius"
            value={radius}
            onValueChange={setRadius}
          />
        </div>
      </div>

      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          zoomed out — bundled dashes
        </p>
        <div className="mt-9">
          <PeckedRing
            label="Coverage radius"
            value={wide}
            onValueChange={setWide}
            min={500}
            max={12000}
            metersPerPixel={60}
          />
        </div>
      </div>
    </main>
  );
}
