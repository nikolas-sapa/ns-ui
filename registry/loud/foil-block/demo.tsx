"use client";

import { FoilBlock } from "./component";

export default function FoilBlockDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / foil-block</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">watch the web index — no input needed</p>
      </header>
      <FoilBlock
        eyebrow="SECTION EYEBROW"
        headline="Headline placeholder goes here"
        primaryLabel="Primary action"
        secondaryLabel="Secondary action"
      />
    </main>
  );
}
