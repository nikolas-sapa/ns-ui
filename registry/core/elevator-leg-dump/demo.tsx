"use client";

import { ElevatorLegDump } from "./component";

export default function ElevatorLegDumpDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-6">
      <p className="self-start font-mono text-xs tracking-widest text-ns-muted">
        ns-ui / elevator-leg-dump
      </p>

      <div className="flex flex-col items-center gap-4 rounded-md border border-border bg-background p-8">
        <div className="h-[360px] w-[180px]">
          <ElevatorLegDump aria-label="Syncing" />
        </div>
        <p className="font-mono text-[11px] text-ns-muted">buckets circulate — no percentage</p>
      </div>
    </main>
  );
}
