"use client";

import { AugerFlightingSpoil } from "./component";

export default function AugerFlightingSpoilDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / auger-flighting-spoil</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          the auger never stops turning — the spoil pile is the proof of work
        </p>
      </header>
      <div className="mx-auto max-w-md p-8">
        <div className="aspect-square w-full overflow-hidden rounded-sm border border-border">
          <AugerFlightingSpoil />
        </div>
      </div>
    </main>
  );
}
