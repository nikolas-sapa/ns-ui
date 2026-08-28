"use client";

import { KnotCapsizeCycle } from "./component";

export default function KnotCapsizeCycleDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / knot-capsize-cycle</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          load breathes the knot through a cycle; it capsizes near peak, re-dresses on release
        </p>
      </header>
      <div className="flex min-h-[calc(100vh-3.75rem)] items-center justify-center p-10">
        <div className="w-full max-w-xs rounded-sm border border-border bg-surface p-8">
          <KnotCapsizeCycle />
        </div>
      </div>
    </main>
  );
}
