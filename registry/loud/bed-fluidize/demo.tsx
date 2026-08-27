"use client";

import { BedFluidize } from "./component";

// The bed is already boiling before anything is touched — bubbles nucleate,
// grow and burst on their own, forever. Hover to locally raise the gas rate
// and pull nucleation toward the cursor, the same local-maldistribution
// behavior a real fluidized-bed operator sees under a disturbance.
export default function BedFluidizeDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <BedFluidize>
        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / bed-fluidize
            </p>
            <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              A bed that never settles.
            </h1>
            <p className="max-w-sm text-sm text-ns-muted">
              Gas voids nucleate at the floor, grow as they climb, merge, and
              burst at the surface — the bed keeps boiling with no input.
            </p>
          </div>
          <a
            href="#docs"
            className="pointer-events-auto mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Read the docs
          </a>
        </div>
      </BedFluidize>
    </main>
  );
}
