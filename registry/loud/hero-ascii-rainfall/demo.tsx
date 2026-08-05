"use client";

import { Downpour } from "./component";

export default function DownpourDemo() {
  return (
    <main className="min-h-screen bg-background">
      {/* move the pointer through the rain — nearby streams bend around it
          like wind gusting through a curtain of rain, then settle straight */}
      <Downpour>
        <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / hero-ascii-rainfall
        </span>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Signal in the static.
        </h1>
        <p className="max-w-md text-sm text-ns-muted sm:text-base">
          Every column falls on its own clock. The cursor is wind, not paint —
          the field bends around it and settles back on its own.
        </p>
        <a
          href="#docs"
          className="mt-2 inline-flex items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Read the docs
        </a>
      </Downpour>
    </main>
  );
}
