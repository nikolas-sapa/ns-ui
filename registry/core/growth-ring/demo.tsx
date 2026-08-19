"use client";

import { GrowthRing, type GrowthRingVersion } from "./component";

// Newest first, like a git log — GrowthRing reverses this internally so
// radius still grows outward with time. Deltas span the full 2-14px clamp:
// v10's +2200 is the "one giant paste" the clamp exists for, v8's +12 sits
// at the floor. Authors hand off three times (v7->v8, v9->v10, v12->v13),
// each a latewood line in the ring chart.
const VERSIONS: GrowthRingVersion[] = [
  { id: "v14", label: "v14", author: "Priya Shah", delta: 340, deltaLabel: "+340 words", time: "14:02" },
  { id: "v13", label: "v13", author: "Priya Shah", delta: 58, deltaLabel: "+58 words", time: "12:47" },
  { id: "v12", label: "v12", author: "Marco Diaz", delta: 210, deltaLabel: "-210 words", time: "11:20" },
  { id: "v11", label: "v11", author: "Marco Diaz", delta: 140, deltaLabel: "+140 words", time: "10:05" },
  { id: "v10", label: "v10", author: "Marco Diaz", delta: 2200, deltaLabel: "+2200 words", time: "09:40" },
  { id: "v9", label: "v9", author: "Jae Lin", delta: 76, deltaLabel: "+76 words", time: "Yesterday 17:12" },
  { id: "v8", label: "v8", author: "Jae Lin", delta: 12, deltaLabel: "+12 words", time: "Yesterday 16:50" },
  { id: "v7", label: "v7", author: "Priya Shah", delta: 300, deltaLabel: "+300 words", time: "Mon 09:15" },
  { id: "v6", label: "v6", author: "Priya Shah", delta: 40, deltaLabel: "+40 words", time: "Mon 08:40" },
];

export default function GrowthRingDemo() {
  return (
    <main className="flex min-h-screen justify-center bg-background px-6 py-16">
      <div className="w-full max-w-2xl">
        <p className="mb-8 font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / growth-ring — version history &amp; restore
        </p>

        <section className="rounded-md border border-border bg-surface/40 p-5">
          <h2 className="text-sm font-medium text-foreground">Draft: Q3 renewal deck</h2>
          <p className="mt-1 text-sm leading-relaxed text-ns-muted">
            Nine saves across three authors. Pick an older version to preview a restore — the
            rings outside it hinge open and dim before anything is discarded.
          </p>
          <div className="mt-5">
            <GrowthRing
              versions={VERSIONS}
              onRestore={(v) => console.log("growth-ring restored to", v.label)}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
