"use client";

import { BlastRoundPattern } from "./component";

export default function BlastRoundPatternDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / blast-hole-delay-sequence</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          delay wave fires row by row, settles to a spent crater, recharges, repeats
        </p>
      </header>
      <div className="flex min-h-[calc(100vh-3.75rem)] items-center justify-center px-6 py-12">
        <div className="aspect-square w-full max-w-md rounded-xl border border-border bg-surface">
          <BlastRoundPattern className="h-full w-full rounded-xl" />
        </div>
      </div>
    </main>
  );
}
