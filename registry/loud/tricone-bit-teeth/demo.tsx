"use client";

import { TriconeBitTeeth } from "./component";

// The rock face is already mid-cycle — a fresh strike ring building, an
// older cluster healing — before anything else on the page loads. Overlaid
// type sits on a token scrim, since the crater ring can pass under any line.
export default function TriconeBitTeethDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <TriconeBitTeeth>
        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-end gap-4 px-6 pb-14 text-center sm:pb-20">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / tricone-bit-teeth
            </p>
            <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Three cones, one bit
            </h1>
            <p className="max-w-sm text-sm text-ns-muted">
              Each pass strikes and scrapes the face — the ring never fills in, and it never empties out.
            </p>
          </div>
          <a
            href="#docs"
            className="pointer-events-auto mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Read the docs
          </a>
        </div>
      </TriconeBitTeeth>
    </main>
  );
}
