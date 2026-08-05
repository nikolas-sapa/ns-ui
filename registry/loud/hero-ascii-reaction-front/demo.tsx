"use client";

import { ReactionFront } from "./component";

export default function ReactionFrontDemo() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0">
        <ReactionFront />
      </div>

      <div className="relative flex min-h-screen flex-col justify-end gap-4 p-8 sm:p-14">
        <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / hero-ascii-reaction-front
        </span>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          The boundary is the picture.
        </h1>
        <p className="max-w-md text-sm text-ns-muted sm:text-base">
          A Gray-Scott dish runs live under the type — a real solver, not a
          loop of noise. Only the ridge of the reaction interface is inked, so
          the reacted interiors and the untouched bulk stay blank and every
          front reads as a thin crawling line. Move the pointer across the
          field to pipette in fresh reagent and watch a new front nucleate
          under the cursor and travel away on its own.
        </p>
        <a
          href="#docs"
          className="mt-2 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Read the docs
        </a>
      </div>
    </main>
  );
}
