"use client";

import { useState } from "react";
import { CapstanScrub } from "./component";

// Two winch drums spanning six orders of magnitude between them: a sample
// offset over a ten-million-unit buffer, and a frame counter over a
// two-hour timeline at 24fps. Wind the drum to gear down; reverse to pay
// the rope back out.
export default function CapstanScrubDemo() {
  const [offset, setOffset] = useState(2_400_000);
  const [frame, setFrame] = useState(86_400);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / capstan-scrub
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          Wind the drum to gear down
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          Drag in circles around the drum. Each completed wrap of rope
          multiplies friction ~8x, so the first wrap covers the whole range
          and the third lands on a single unit. Reverse direction and the
          rope pays out before the value moves coarse again.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <CapstanScrub
            label="Sample offset"
            value={offset}
            onValueChange={setOffset}
            min={0}
            max={10_000_000}
            step={1}
            unit="smp"
          />
          <CapstanScrub
            label="Frame"
            value={frame}
            onValueChange={setFrame}
            min={0}
            max={172_800}
            step={1}
            unit="fr"
          />
        </div>

        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          arrows step at the current gear · PageUp/PageDown add or remove a
          wrap · Home rewinds
        </p>
      </div>
    </main>
  );
}
