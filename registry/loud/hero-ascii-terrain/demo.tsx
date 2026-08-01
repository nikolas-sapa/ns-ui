"use client";

import { ScarpHorizon } from "./component";

export default function ScarpHorizonDemo() {
  return (
    <main className="min-h-screen bg-background">
      {/* move the pointer across the field, near ridges slide faster than
          the horizon, like looking out of a moving window */}
      <ScarpHorizon>
        <span className="font-mono text-xs tracking-[0.25em] text-muted">
          ns-ui / hero-ascii-terrain
        </span>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Terrain rendered in type.
        </h1>
        <p className="max-w-md text-sm text-muted sm:text-base">
          Layered ridgelines, deterministic noise, a horizon that answers to
          the pointer, no images, no dependencies, just characters.
        </p>
        <a
          href="#docs"
          className="mt-2 inline-flex items-center justify-center rounded-sm bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Read the docs
        </a>
      </ScarpHorizon>
    </main>
  );
}
