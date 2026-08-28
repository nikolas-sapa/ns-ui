"use client";

import { VenturiEjectorDraw } from "./component";

export default function VenturiEjectorDrawDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / venturi-ejector-draw
      </p>

      <div
        data-venturi-hero
        className="flex w-full max-w-md flex-col gap-5 rounded-xl border border-border bg-surface p-6"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Analyzing dataset</p>
          <span className="font-mono text-[11px] text-ns-muted">background job</span>
        </div>
        <div className="h-40 w-full">
          <VenturiEjectorDraw label="Analyzing dataset" className="h-full w-full" />
        </div>
        <p className="font-mono text-[11px] text-ns-muted">
          throat width 22% of inlet — one marked tracer every 2.4s
        </p>
      </div>

      <div className="grid w-full max-w-md grid-cols-2 gap-4">
        <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-surface p-3">
          <VenturiEjectorDraw label="Processing" className="h-full w-full" />
        </div>
        <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-surface p-3">
          <VenturiEjectorDraw label="Syncing" className="h-full w-full" />
        </div>
      </div>
    </main>
  );
}
