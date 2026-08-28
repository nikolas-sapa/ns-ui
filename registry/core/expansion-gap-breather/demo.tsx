"use client";

import { ExpansionGapBreather } from "./component";

export default function ExpansionGapBreatherDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / expansion-gap-breather
        </p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          the seam between the two panels breathes 4-22px on a 14s cycle
        </p>
      </header>
      <div className="flex h-[calc(100vh-3.75rem)] items-stretch">
        <section className="flex flex-1 flex-col justify-center gap-2 px-10">
          <p className="font-mono text-[11px] tracking-widest text-ns-muted">PANEL A</p>
          <p className="max-w-sm text-sm leading-relaxed text-ns-muted">
            A layout region of one measured size, independent of its neighbour across
            the seam.
          </p>
        </section>
        <ExpansionGapBreather />
        <section className="flex flex-[1.6] flex-col justify-center gap-2 px-10">
          <p className="font-mono text-[11px] tracking-widest text-ns-muted">PANEL B</p>
          <p className="max-w-md text-sm leading-relaxed text-ns-muted">
            A second region, a different measured size — the joint between them
            widens and narrows on its own clock rather than sitting as a static
            rule.
          </p>
        </section>
      </div>
    </main>
  );
}
