"use client";

import { PancakeLap } from "./component";

// The field is already mid-turnover before anything is touched. Overlaid
// type sits in a translucent card, same pattern as the other loud
// full-bleed backgrounds — the pan field itself needs no reading-zone mask
// since pans are small relative to a hero and never approach card contrast.
export default function PancakeLapDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <PancakeLap>
        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / pancake-lap
            </p>
            <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Ice finding its edge
            </h1>
            <p className="max-w-sm text-sm text-ns-muted">
              A field of pans jostles on open water. Every couple of seconds
              one climbs a neighbour&apos;s rim and welds there for good.
            </p>
          </div>
          <a
            href="#docs"
            className="pointer-events-auto mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Read the docs
          </a>
        </div>
      </PancakeLap>
    </main>
  );
}
