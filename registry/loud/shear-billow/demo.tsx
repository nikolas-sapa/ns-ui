"use client";

import { ShearBillow } from "./component";

// The layer runs on its own — the billow train is already wound before anyone
// touches it — so the demo is just the full-bleed field with token type over it.
export default function ShearBillowDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <ShearBillow billows={6}>
        {/* the stratification spans the full value range in both themes, so
            overlaid type needs a token scrim rather than bare contrast */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-6 pb-14 text-center sm:pb-20">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / shear-billow
            </p>
            <p className="max-w-sm text-sm text-foreground sm:text-base">
              A shear interface breaking into a train of spiral billows. Drag through it
              to stir the layers.
            </p>
          </div>
          <a
            href="#docs"
            className="pointer-events-auto mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Read the docs
          </a>
        </div>
      </ShearBillow>
    </main>
  );
}
