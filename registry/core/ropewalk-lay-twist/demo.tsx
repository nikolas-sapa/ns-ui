"use client";

import { RopewalkLayTwist } from "./component";

export default function RopewalkLayTwistDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / ropewalk-lay-twist</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          3 strands twist together and wind onto a drum that never stops filling
        </p>
      </header>
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
        <div>
          <h2 className="mb-3 font-mono text-sm text-foreground">Build queue card</h2>
          <p className="mb-4 max-w-prose font-mono text-xs text-ns-muted">
            Used as an ambient background strip behind a card header — the
            rope keeps being laid regardless of what the card above it says.
          </p>
          <div className="overflow-hidden rounded-md border border-border">
            <RopewalkLayTwist />
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-mono text-sm text-foreground">Taller card</h2>
          <div className="overflow-hidden rounded-md border border-border">
            <RopewalkLayTwist height={220} label="Deploy pipeline running" />
          </div>
        </div>
      </div>
    </main>
  );
}
