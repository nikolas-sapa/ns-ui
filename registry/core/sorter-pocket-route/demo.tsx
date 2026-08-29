"use client";

import { SorterPocketRoute } from "./component";

export default function SorterPocketRouteDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-ns-muted">
        ns-ui / sorter-pocket-route
      </p>

      <div
        data-sorter-pocket-route-hero
        className="w-full max-w-md rounded-xl border border-border bg-surface px-8 py-8"
      >
        <SorterPocketRoute label="Organizing records" />
      </div>

      <p className="max-w-sm text-center font-mono text-[10px] text-ns-muted">
        one card at a time — drop, gate-swing, land — the pockets fill unevenly, forever
      </p>
    </main>
  );
}
