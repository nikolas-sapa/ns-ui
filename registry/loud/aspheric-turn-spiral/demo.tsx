"use client";

import { AsphericTurnSpiral } from "./component";

// A plain accessible heading sits over the surface with a token scrim, the
// same pattern as weld-pool's demo — the lens surface itself carries no
// baked-in type, so there's no accessibility mirror to keep in sync.
export default function AsphericTurnSpiralDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <AsphericTurnSpiral>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-6 pb-14 text-center sm:pb-20">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / aspheric-turn-spiral
            </p>
            <h1 className="max-w-sm text-sm text-foreground sm:text-base">
              A lens surface mid-cut, the diamond still tracing its way to the rim.
            </h1>
          </div>
          <a
            href="#docs"
            className="pointer-events-auto mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Read the docs
          </a>
        </div>
      </AsphericTurnSpiral>
    </main>
  );
}
