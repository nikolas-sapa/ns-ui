"use client";

import { useState } from "react";
import { ChainScale } from "./component";

// a mock map viewport whose aria-describedby is wired to the control's own
// live scale sentence — the pattern a real map integration would follow.
export default function ChainScaleDemo() {
  const [mpp, setMpp] = useState(1);
  const descId = "chain-scale-metro-desc";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / chain-scale
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          The zoom control is the scale bar
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          Grab the handle at the bar&apos;s end and stretch it — the map zooms
          so the printed distance is always a round, sayable number. Between
          denominations the bar keeps growing under your pointer; at each
          crossing it springs to the new fraction of its width and the
          checkerboard re-subdivides.
        </p>

        <div
          role="region"
          aria-label="Sample map"
          aria-describedby={descId}
          className="relative mt-5 flex h-56 items-center justify-center overflow-hidden rounded-md border border-border bg-background"
          style={{
            backgroundImage:
              "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          <span className="font-mono text-[11px] text-ns-muted">
            1 px = {mpp < 1 ? `${(mpp * 100).toFixed(0)} cm` : `${mpp.toFixed(mpp < 10 ? 1 : 0)} m`} on the ground
          </span>

          <div className="absolute bottom-3 left-3">
            <ChainScale
              id="chain-scale-metro"
              label="Map scale"
              defaultMetersPerPixel={1}
              minMetersPerPixel={0.05}
              maxMetersPerPixel={5000}
              maxWidth={180}
              onValueChange={setMpp}
            />
          </div>
        </div>

        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          drag the handle or scroll the wheel over it to zoom · arrows step
          one round denomination · double-click resets to 3/4 width
        </p>
      </div>
    </main>
  );
}
