"use client";

import { StrikeFigure } from "./component";

export default function StrikeFigureDemo() {
  return (
    <main className="min-h-screen bg-background">
      {/* hold the pointer anywhere over the field — it becomes the electrode
          the next branches fork toward; leave, and the growth returns to its
          own statistics */}
      <StrikeFigure>
        <span className="font-mono text-xs tracking-[0.25em] text-muted">
          ns-ui / hero-ascii-lichtenberg
        </span>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Every path is the steepest one.
        </h1>
        <p className="max-w-md text-sm text-muted sm:text-base">
          A dielectric breakdown solved live on the character grid. The channel
          only ever grows where the field is strongest, so the figure forks
          itself into existence.
        </p>
        <a
          href="#docs"
          className="mt-2 inline-flex items-center justify-center rounded-sm bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Read the docs
        </a>
      </StrikeFigure>
    </main>
  );
}
