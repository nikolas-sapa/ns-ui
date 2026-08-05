"use client";

import { MeshTextDrag } from "./component";

export default function MeshTextDragDemo() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-16">
      <p className="mb-6 font-mono text-xs tracking-[0.25em] text-ns-muted">
        ns-ui / hero-cloth-type
      </p>
      <MeshTextDrag text="ELASTIC" />
      <p className="mt-2 font-mono text-sm text-ns-muted">
        drag your cursor across the type — the mesh follows and springs back
      </p>
      <button
        type="button"
        className="mt-10 rounded-sm border border-border bg-surface px-4 py-2 font-mono text-xs text-ns-muted transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        view source
      </button>
    </main>
  );
}
