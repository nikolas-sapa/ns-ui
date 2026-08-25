"use client";

import { AttributeClash404 } from "./component";

export default function AttributeClash404Demo() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
            ns://ui
          </span>
          <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
            ns-ui / not-found-attribute-clash
          </span>
        </div>
        <a
          href="#docs"
          className="rounded-sm px-2 py-1 font-mono text-xs text-ns-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          docs
        </a>
      </header>

      <div className="relative min-h-0 flex-1">
        <AttributeClash404 className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 bottom-10 flex flex-col items-center gap-3 px-6 text-center">
          <h1 className="font-mono text-sm font-semibold tracking-[0.2em] text-foreground">
            404 — PAGE NOT FOUND
          </h1>
          <p className="max-w-sm font-mono text-xs text-ns-muted">
            This page needed finer detail than the grid budget allows — every
            cell fought for one glyph and lost.
          </p>
          <a
            href="#home"
            className="pointer-events-auto rounded-sm border border-border px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Take me home
          </a>
        </div>
      </div>

      <footer className="flex items-center justify-between border-t border-border px-6 py-3">
        <span className="font-mono text-xs text-ns-muted">
          ERR 404 / attribute clash
        </span>
        <span className="font-mono text-xs text-ns-muted">
          trace: cell budget exceeded / one glyph+weight pair per block
        </span>
      </footer>
    </main>
  );
}
