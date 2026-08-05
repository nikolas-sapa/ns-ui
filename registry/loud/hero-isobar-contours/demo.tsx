"use client";

import { PressureFront } from "./component";

export default function PressureFrontDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / hero-isobar-contours
        </p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          the contour lines bunch tighter the closer they get to the button —
          hover it to deepen the low
        </p>
      </header>
      <PressureFront
        eyebrow="ISOBAR-01"
        headline={["Every line", "points here"]}
        subcopy="Pressure Front reads the room before anyone clicks: the whole layout is a low-pressure system centered on one button, and every ring of contour drawn around it exists to say so."
        primaryCta={{ label: "Start free trial", href: "#start" }}
        secondaryCta={{ label: "See how it works", href: "#how" }}
        className="min-h-[calc(100vh-3.75rem)]"
      />
    </main>
  );
}
