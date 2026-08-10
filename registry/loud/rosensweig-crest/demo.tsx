"use client";

import { RosensweigCrest } from "./component";

export default function RosensweigCrestDemo() {
  return (
    <main className="min-h-screen bg-background">
      {/* move the pointer across the field — above the threshold radius the
          surface erupts into a hex lattice of spikes and tracks the cursor
          with a heavy, viscous lag; leave and it slumps flat again */}
      <RosensweigCrest>
        <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / rosensweig-crest
        </span>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          A surface with a phase change.
        </h1>
        <p className="max-w-md text-sm text-ns-muted sm:text-base">
          Flat glyphs until the field crosses threshold, then a hexagonal
          lattice of spikes rises to meet the cursor and slumps back once it
          leaves. The headline sits in a zone the fluid never breaches.
        </p>
        <a
          href="#docs"
          className="mt-2 inline-flex items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Read the docs
        </a>
      </RosensweigCrest>
    </main>
  );
}
