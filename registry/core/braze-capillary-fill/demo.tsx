"use client";

import { BrazeCapillaryFill } from "./component";

export default function BrazeCapillaryFillDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / braze-capillary-fill
        </p>
        <h1 className="text-lg font-semibold text-foreground">Import in progress</h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          Filler wicks sideways along the seam under its own capillary pull,
          not a bar filling left to right — a bright front leads a settling
          trail and pools into a fillet the moment it reaches the far edge.
        </p>

        <div className="mt-5 rounded-md border border-border bg-surface p-5">
          <BrazeCapillaryFill label="Import" />
        </div>
      </div>
    </main>
  );
}
