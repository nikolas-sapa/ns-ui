"use client";

import { RangeLightTransit } from "./component";

export default function RangeLightTransitDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / range-light-transit
        </p>
        <h1 className="text-lg font-semibold text-foreground">Sync status</h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          Two independent, slowly-drifting states read as converging the way
          a pair of maritime range lights read as a safe channel: the far
          light and the near light slide apart and repeatedly slide back into
          line, briefly brightening together each time they agree.
        </p>

        <div className="mt-5 rounded-md border border-border bg-surface p-5">
          <RangeLightTransit label="Peer sync" />
        </div>
      </div>
    </main>
  );
}
