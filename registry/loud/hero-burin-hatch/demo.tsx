"use client";

import { BurinHatch } from "./component";

export default function BurinHatchDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / hero-burin-hatch
        </p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          move the cursor over the plate — the light follows it
        </p>
      </header>
      <BurinHatch
        eyebrow="PLATE 04 / INTAGLIO"
        headline={["Tone is the", "width of the cut"]}
        subcopy="No fills, no gradients. The sphere is only meridian lines whose strokes swell into shadow, vanish to blank paper in the light, and pick up a second cross-hatch pass where the shade runs deepest."
        primaryCta={{ label: "Pull a proof", href: "#proof" }}
        secondaryCta={{ label: "Read the method", href: "#method" }}
        className="min-h-[calc(100vh-3.75rem)]"
      />
    </main>
  );
}
