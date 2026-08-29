"use client";

import { GlutenWindowpane } from "./component";

export default function GlutenWindowpaneDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / gluten-windowpane
      </p>
      <GlutenWindowpane label="Analyzing" />
      <p className="max-w-sm text-center font-mono text-[11px] tracking-widest text-ns-muted">
        stretched, held, and released on a 4-cycle knead loop — opaque and jittery to translucent and straight
      </p>
    </main>
  );
}
