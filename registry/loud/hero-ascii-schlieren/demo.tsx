"use client";

import { SchlierenRig } from "./component";

export default function SchlierenRigDemo() {
  return (
    <main className="min-h-screen bg-background">
      {/* sweep the pointer left to right — that is the knife rotating, and it
          re-selects which density boundaries the bench transmits */}
      <SchlierenRig>
        <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / hero-ascii-schlieren
        </span>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Only the edges survive.
        </h1>
        <p className="max-w-md text-sm text-ns-muted sm:text-base">
          Still air transmits nothing — only the steep density boundaries of a
          rising thermal survive the knife edge. Sweep the pointer across the
          field to rotate that knife and re-select which boundaries show.
        </p>
        <a
          href="#docs"
          className="mt-2 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Read the docs
        </a>
      </SchlierenRig>
    </main>
  );
}
