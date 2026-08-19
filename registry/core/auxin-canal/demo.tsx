"use client";

import { AuxinCanal } from "./component";

export default function AuxinCanalDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / auxin-canal</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          veins grow through the space around the copy, rest, drain, and scatter again
        </p>
      </header>
      <AuxinCanal className="min-h-[calc(100vh-3.75rem)]" />
    </main>
  );
}
