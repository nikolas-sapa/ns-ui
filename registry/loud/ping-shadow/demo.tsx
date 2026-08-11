"use client";

import { PingShadow } from "./component";

// The display is the page. Everything else is ordinary DOM type on tokens,
// sitting over it behind a scrim — the acoustic image spans the full value
// range in both themes, so unbacked type would cross a bright wedge and a
// shadow inside one line.
export default function PingShadowDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <PingShadow>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-6 pb-14 text-center sm:pb-20">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / ping-shadow
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Bottom return, swath 1
            </h1>
            <p className="max-w-sm text-sm text-ns-muted">
              Move across to steer the sector and pull the focus in or out along range.
            </p>
          </div>
          <a
            href="#docs"
            className="pointer-events-auto mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Read the docs
          </a>
        </div>
      </PingShadow>
    </main>
  );
}
