"use client";

import { EdgeBurnishGlaze } from "./component";

export default function EdgeBurnishGlazeDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / edge-burnish-glaze</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          a slicker sweeps the edge, cells stay glossiest mid-sweep and dull where it's due to circle back
        </p>
      </header>
      <div className="mx-auto max-w-3xl px-6 py-24">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">Section one</h2>
          <p className="text-sm leading-relaxed text-ns-muted">
            A burnished edge divider sits below, standing in for a plain horizontal rule between
            two sections of copy.
          </p>
        </div>
        <EdgeBurnishGlaze className="my-16" />
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">Section two</h2>
          <p className="text-sm leading-relaxed text-ns-muted">
            The stroke never finishes its pass — it keeps sweeping back and forth for as long as
            the divider is on screen, exactly like a leatherworker reburnishing an edge that keeps
            losing its sheen.
          </p>
        </div>
      </div>
    </main>
  );
}
