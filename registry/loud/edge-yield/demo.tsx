"use client";

import { EdgeYield } from "./component";

// The specimen fills the viewport and the stage is already drifting under the
// beam before anything is touched. Overlaid type sits on a token scrim, because
// a grain rim can pass under any line of it and the micrograph spans the full
// value range in both themes.
export default function EdgeYieldDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <EdgeYield>
        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-end gap-4 px-6 pb-14 text-center sm:pb-20">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / edge-yield
            </p>
            <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Ten thousand times
            </h1>
            <p className="max-w-sm text-sm text-ns-muted">
              Move across the frame to pan the stage and park the beam.
            </p>
          </div>
          <a
            href="#docs"
            className="pointer-events-auto mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Read the docs
          </a>
        </div>
      </EdgeYield>
    </main>
  );
}
