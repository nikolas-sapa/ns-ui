"use client";

import { FilmGateWeave } from "./component";

// The gate is fixed and rigid from the first frame; the test-pattern content
// is already mid-drift and mid-bounce before anything is touched. Overlaid
// type sits centred inside the aperture, clear of the strokes at rest.
export default function FilmGateWeaveDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <FilmGateWeave>
        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / film-gate-weave
            </p>
            <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Never quite flush with the gate
            </h1>
            <p className="max-w-sm text-sm text-ns-muted">
              The aperture is fixed. The frame inside it never is — weave drifts it slowly,
              bounce snaps it every claw pull.
            </p>
          </div>
          <a
            href="#docs"
            className="pointer-events-auto mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Read the docs
          </a>
        </div>
      </FilmGateWeave>
    </main>
  );
}
