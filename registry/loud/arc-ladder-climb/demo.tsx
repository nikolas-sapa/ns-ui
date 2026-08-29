"use client";

import { ArcLadderClimb } from "./component";

export default function ArcLadderClimbDemo() {
  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border px-6 py-16">
        <p className="mx-auto max-w-3xl font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / arc-ladder-climb
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          A divider that never stops striking.
        </h1>
      </section>

      {/* the divider itself: no headline slot needed here, but children are
          supported for a section label sitting over the field */}
      <ArcLadderClimb />

      <section className="border-t border-border px-6 py-16">
        <p className="mx-auto max-w-3xl text-sm leading-relaxed text-ns-muted">
          Two rails diverge from a narrow gap at the base. An arc strikes there
          first, climbs the widening gap as buoyancy drags it up, and dies near
          the top when the gap outgrows the supply — then a fresh arc restrikes
          almost immediately, forever.
        </p>
      </section>
    </main>
  );
}
