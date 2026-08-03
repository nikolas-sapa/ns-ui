"use client";

import { Totality } from "./component";

export default function TotalityDemo() {
  return (
    <main className="min-h-screen bg-background">
      {/* drag the pointer across the sun — as the moon's center nears the
          sun's, the corona blooms into a bright ring */}
      <Totality>
        <span className="font-mono text-xs tracking-[0.25em] text-muted">
          ns-ui / hero-ascii-eclipse
        </span>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Bring it to totality.
        </h1>
        <p className="max-w-md text-sm text-muted sm:text-base">
          The cursor carries the transit. Line the centers up and the corona
          answers — no images, no dependencies, just characters.
        </p>
        <a
          href="#docs"
          className="mt-2 inline-flex items-center justify-center rounded-sm bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Read the docs
        </a>
      </Totality>
    </main>
  );
}
