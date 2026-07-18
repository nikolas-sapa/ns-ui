"use client";

import { WarpLattice } from "./component";

export default function WarpLatticeDemo() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-6 py-20">
        <header className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            ns-ui / warp-lattice
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            The grid is the medium
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Hairline lattice and card grid share one displacement field. Move
            the cursor — the sheet bends toward it, and the cards ride the bent
            lattice instead of floating over it. Flick fast and watch the sheet
            relax behind you.
          </p>
        </header>

        <WarpLattice className="min-h-[520px] rounded-md border border-border" />

        <footer className="flex items-center gap-4">
          <button
            type="button"
            className="rounded-sm border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Browse components
          </button>
          <span className="font-mono text-xs text-muted">
            one field · one loop · zero deps
          </span>
        </footer>
      </section>
    </main>
  );
}
