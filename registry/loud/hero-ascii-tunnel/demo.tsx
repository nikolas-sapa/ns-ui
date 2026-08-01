"use client";

import { VanishRun } from "./component";

export default function VanishRunDemo() {
  return (
    <main className="min-h-screen bg-background">
      {/* move the pointer around — the whole corridor tilts to steer toward
          it, while the rings keep advancing on their own loop */}
      <VanishRun>
        <span className="font-mono text-xs tracking-[0.25em] text-muted">
          ns-ui / vanish-run
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Forward, always forward.
        </h1>
        <p className="max-w-sm text-sm text-muted sm:text-base">
          A corridor drawn entirely in characters, depth from ink weight
          alone, steered by the cursor.
        </p>
        <a
          href="#docs"
          className="mt-2 inline-flex items-center justify-center rounded-sm bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Read the docs
        </a>
      </VanishRun>
    </main>
  );
}
