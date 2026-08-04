"use client";

import { PenroseInflate } from "./component";

export default function PenroseInflateDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-muted">
          ns-ui / hero-penrose-inflate
        </p>
        <p className="hidden font-mono text-[11px] text-muted sm:block">
          move the pointer — the tiling inflates one substitution level finer
          under the cursor
        </p>
      </header>
      <PenroseInflate
        eyebrow="P3 / APERIODIC"
        headline={["Order without", "repetition"]}
        subcopy="Two rhombi and a single substitution rule generate a pattern with five-fold symmetry that never repeats itself, at any scale, anywhere. The field below is drifting through an endless golden-ratio zoom into its own structure."
        primaryCta={{ label: "Start building", href: "#start" }}
        secondaryCta={{ label: "Read the derivation", href: "#derivation" }}
        className="min-h-[calc(100vh-3.75rem)]"
      />
    </main>
  );
}
