"use client";

import { JumboDrillBoomPattern } from "./component";

// The pattern is already a third drilled and mid-plunge before anything is
// touched. Overlaid type sits centered over the rock face — the boom stays
// clear of the middle collars for most of the cycle since drilling grows
// outward from center, but the copy itself needs no dedicated reading zone
// carve-out the way a continuously-busy field would.
export default function JumboDrillBoomPatternDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <JumboDrillBoomPattern>
        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / jumbo-drill-boom-pattern
            </p>
            <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Drilling the round
            </h1>
            <p className="max-w-sm text-sm text-ns-muted">
              One boom works the face collar by collar, plunging and
              withdrawing, before the pattern fires and a fresh face opens.
            </p>
          </div>
          <a
            href="#docs"
            className="pointer-events-auto mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Read the docs
          </a>
        </div>
      </JumboDrillBoomPattern>
    </main>
  );
}
