"use client";

import { MillstoneFurrowFlow } from "./component";

export default function MillstoneFurrowFlowDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / millstone-furrow-flow</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          bedstone and runner furrows cross into a drifting moiré, grain spirals from eye to rim
        </p>
      </header>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <MillstoneFurrowFlow className="h-96 w-full rounded-sm border border-border" />
      </div>
    </main>
  );
}
