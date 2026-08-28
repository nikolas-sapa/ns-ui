"use client";

import { TourbillonCage } from "./component";

// The carriage-and-balance loop is the unconditional idle animation from
// mount, so the demo needs nothing beyond mounting the cage itself plus a
// token-scrimmed caption over it.
export default function TourbillonCageDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <TourbillonCage>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-6 pb-14 sm:pb-20">
          <div className="rounded-lg bg-background/70 px-5 py-3 text-center backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / tourbillon-cage
            </p>
          </div>
        </div>
      </TourbillonCage>
    </main>
  );
}
