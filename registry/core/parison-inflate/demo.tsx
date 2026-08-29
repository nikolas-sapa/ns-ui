"use client";

import { ParisonInflate } from "./component";

export default function ParisonInflateDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / parison-inflate
        </p>
        <h1 className="text-lg font-semibold text-foreground">Storage used</h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          A bubble instead of a bar — the wall thins as it inflates,
          decelerating like a real blown parison, then deflates and reheats
          for the next breath.
        </p>

        <div className="mt-5 rounded-md border border-border bg-surface p-5">
          <ParisonInflate label="Storage used" />
        </div>
      </div>
    </main>
  );
}
