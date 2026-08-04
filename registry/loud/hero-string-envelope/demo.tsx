"use client";

import { StringEnvelope } from "./component";

export default function StringEnvelopeDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-muted">
          ns-ui / hero-string-envelope
        </p>
        <p className="hidden font-mono text-[11px] text-muted sm:block">
          240 straight chords, i to k&middot;i — move across to morph k and split the
          cusps
        </p>
      </header>
      <StringEnvelope
        eyebrow="ENVELOPE-01 / k = 3, NEPHROID"
        headline={["Nothing here", "is a curve"]}
        subcopy="Every mark on this page is a straight line between two points on a circle. The bright edge is where they crowd — an epicycloid nobody drew. Slide across the hero and the multiplier moves with you."
        primaryCta={{ label: "Read the construction", href: "#construction" }}
        secondaryCta={{ label: "Copy the component", href: "#install" }}
        className="min-h-[calc(100vh-3.75rem)]"
      />
    </main>
  );
}
