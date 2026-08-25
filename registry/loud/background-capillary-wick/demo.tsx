"use client";

import { BackgroundCapillaryWick } from "./component";

// The wick fills the whole viewport and is already mid-advance before
// anything is touched. Overlaid type sits inside the mesh's own low-coverage
// reading zone (biased at mount, not a separate scrim), centred where the
// component naturally keeps ink lightest.
export default function BackgroundCapillaryWickDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <BackgroundCapillaryWick>
        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / background-capillary-wick
            </p>
            <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Ink finding paper
            </h1>
            <p className="max-w-sm text-sm text-ns-muted">
              Fronts wick along a fixed fibre lattice, stall at every junction,
              and dry back out to make room for the next one.
            </p>
          </div>
          <a
            href="#docs"
            className="pointer-events-auto mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Read the docs
          </a>
        </div>
      </BackgroundCapillaryWick>
    </main>
  );
}
