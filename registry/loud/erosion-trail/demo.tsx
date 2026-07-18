"use client";

import { ErosionTrail } from "./component";

export default function ErosionTrailDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-4xl">
        <p className="mb-6 font-mono text-xs tracking-[0.25em] text-muted">
          ns-ui / erosion-trail
        </p>
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <ErosionTrail className="h-96" />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="font-mono text-xs tracking-[0.25em] text-muted">
            DRAG TO CARVE
          </p>
          <p className="font-mono text-xs text-muted">
            sediment heals in ~6s
          </p>
        </div>
        <button
          type="button"
          className="mt-10 rounded-sm border border-border bg-surface px-4 py-2 font-mono text-xs text-muted transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          view source
        </button>
      </div>
    </main>
  );
}
