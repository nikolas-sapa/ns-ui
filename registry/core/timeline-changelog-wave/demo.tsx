"use client";

import { Strandline } from "./component";

export default function StrandlineDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-3xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / timeline-changelog-wave
        </p>

        <div className="rounded-md border border-border bg-surface p-6 sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 className="font-mono text-sm tracking-widest text-foreground">
              CHANGELOG / 2026
            </h2>
            <p className="font-mono text-[10px] tracking-wider text-muted">
              6 RELEASES · 1 MAJOR
            </p>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            The year as a rising tide — every release breaks further up the
            strand, and older marks collect tide-rings with each wash.
          </p>

          <Strandline className="mt-2 h-80" />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-4">
            <p className="font-mono text-[10px] tracking-wider text-muted">
              SCRUB WITH THE ARROWS — EACH STEP LAUNCHES THE NEXT WAVE
            </p>
            <p className="font-mono text-[10px] tracking-wider text-muted">
              HOVER A MARK TO REPLAY ITS SWASH
            </p>
          </div>
        </div>

        <p className="mt-3 font-mono text-[11px] text-muted">
          ring density is history — the oldest release, nearest the water, has
          been washed the most
        </p>
      </div>
    </main>
  );
}
