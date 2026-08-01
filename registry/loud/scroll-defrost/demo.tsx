"use client";

import { FrostScrub } from "./component";

export default function FrostScrubDemo() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="flex h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-mono text-xs tracking-[0.25em] text-muted">
          ns-ui / scroll-defrost
        </p>
        <h1 className="max-w-2xl text-5xl font-semibold tracking-tight md:text-6xl">
          Scroll is the defroster.
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted">
          A pinned still behind rippled shower glass. Scrub down to anneal the
          pane — refraction, chromatic fringing and frost scatter melt to
          optical clarity, fully reversible.
        </p>
        <span className="font-mono text-xs tracking-[0.25em] text-muted">
          SCROLL
        </span>
      </section>

      <FrostScrub />

      <section className="flex flex-col items-center gap-6 px-6 py-32 text-center">
        <p className="max-w-md text-sm text-muted">
          Annealed. Scroll back up to refrost the pane.
        </p>
        <button
          type="button"
          className="rounded-sm border border-border bg-surface px-4 py-2 font-mono text-xs text-muted transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          view source
        </button>
      </section>
    </main>
  );
}
