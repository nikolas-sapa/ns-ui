"use client";

import { BrailleOrbit } from "./component";

export default function BrailleOrbitDemo() {
  return (
    <div
      data-braille-orbit-card
      className="flex min-h-screen flex-col items-center justify-center gap-14 px-6"
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / empty-state-braille-orbit
      </p>

      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-xl border border-border bg-surface px-10 py-14 text-center">
        {/* The orbit is purely decorative (aria-hidden inside the component)
            — heading + description below are the empty state's real,
            screen-reader-visible content, never encoded in the glyph art. */}
        <BrailleOrbit size={120} />
        <div className="flex flex-col gap-1.5">
          <h2 className="text-sm font-medium text-foreground">No results yet</h2>
          <p className="max-w-xs text-sm text-ns-muted">
            Once you add data, it will show up here.
          </p>
        </div>
      </div>
    </div>
  );
}
