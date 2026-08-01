"use client";

import { GantryRun } from "./component";

export default function GantryRunDemo() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5">
        <span className="font-mono text-xs tracking-widest text-muted">ns-ui / gallery-gantry-track</span>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="rounded-sm border border-border bg-surface px-4 py-2 font-mono text-xs tracking-widest text-foreground transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-px hover:border-accent active:translate-y-0 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          TOP
        </button>
      </header>

      <GantryRun />
    </main>
  );
}
