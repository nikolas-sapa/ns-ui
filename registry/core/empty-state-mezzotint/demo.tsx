"use client";

import { Mezzotint } from "./component";

export default function MezzotintDemo() {
  return (
    <div
      data-mezzotint-card
      className="flex min-h-screen flex-col items-center justify-center gap-14 px-6"
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / empty-state-mezzotint
      </p>

      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-xl border border-border bg-surface px-10 py-14 text-center">
        {/* The plate is purely decorative (aria-hidden inside the component)
            — heading, description and the CTA below are the empty state's
            real, screen-reader-visible content, never encoded in the glyph
            art. --ns-accent stays out of the plate entirely and only shows
            up here, on the interactive button. */}
        <Mezzotint size={140} />
        <div className="flex flex-col gap-1.5">
          <h2 className="text-sm font-medium text-foreground">No plates yet</h2>
          <p className="max-w-xs text-sm text-ns-muted">
            Once you add one, it will show up here.
          </p>
        </div>
        <button
          type="button"
          className="rounded-sm bg-ns-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ns-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Create your first item
        </button>
      </div>
    </div>
  );
}
