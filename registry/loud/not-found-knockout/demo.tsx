"use client";

import { Knockout404 } from "./component";

export default function Knockout404Demo() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
            ns://ui
          </span>
          <span className="font-mono text-xs tracking-[0.25em] text-muted">
            ns-ui / not-found-knockout
          </span>
        </div>
        <a
          href="#docs"
          className="rounded-sm px-2 py-1 font-mono text-xs text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          docs
        </a>
      </header>

      {/* the numerals are punched through the surface — move the cursor
          along their edges to nudge the stencil rim */}
      <Knockout404 className="min-h-0 flex-1" />

      <footer className="flex items-center justify-between border-t border-border px-6 py-3">
        <span className="font-mono text-xs text-muted">
          ERR 404 / route unresolved
        </span>
        <span className="font-mono text-xs text-muted">
          trace: surface plane carved / void exposed
        </span>
      </footer>
    </main>
  );
}
