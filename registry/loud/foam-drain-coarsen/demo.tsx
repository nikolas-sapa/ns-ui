"use client";

import { FoamDrainCoarsen } from "./component";

// The mesh is already coarsening before anything is touched — cells grow or
// shrink under von Neumann's law, small ones vanish, borders thicken toward
// the base as the field drains, then slowly re-wets from below and drains
// again, forever. Hover to locally brighten nearby borders in luminance
// only, the same way a disturbance shows up on a real foam's Plateau
// borders.
export default function FoamDrainCoarsenDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <FoamDrainCoarsen>
        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / foam-drain-coarsen
            </p>
            <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              A foam that keeps coarsening.
            </h1>
            <p className="max-w-sm text-sm text-ns-muted">
              Cells grow and vanish under a real growth law while the borders
              drain from wet at the base to dry at the top, forever.
            </p>
          </div>
          <a
            href="#docs"
            className="pointer-events-auto mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Read the docs
          </a>
        </div>
      </FoamDrainCoarsen>
    </main>
  );
}
