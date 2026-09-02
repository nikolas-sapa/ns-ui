"use client";

import { FoilBlock } from "./component";

export default function FoilBlockDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / foil-block</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">the web indexes on its own — no input needed</p>
      </header>
      <FoilBlock
        eyebrow="GET STARTED"
        headline="Every release lands finished"
        primaryLabel="Start building"
        secondaryLabel="Read the docs"
      />
    </main>
  );
}
