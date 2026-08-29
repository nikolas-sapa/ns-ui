"use client";

import { OrbWebConstruction } from "./component";

// The web builds itself on its own internal clock — everything below is
// ordinary DOM type sitting over it behind a scrim so copy stays legible
// against however much silk has been laid at any given moment.
export default function OrbWebConstructionDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <OrbWebConstruction>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end gap-4 px-6 pb-14 text-center sm:pb-20">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/80 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / orb-web-construction
            </p>
            <p className="max-w-sm text-sm text-foreground sm:text-base">
              Bridge, frame, radii, scaffold spiral, capture spiral — built in
              the spider&apos;s own order, then torn and repaired one sector
              at a time.
            </p>
          </div>
          <a
            href="#docs"
            className="pointer-events-auto mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Read the docs
          </a>
        </div>
      </OrbWebConstruction>
    </main>
  );
}
