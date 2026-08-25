"use client";

import { SixelReveal } from "./component";

export default function SixelRevealDemo() {
  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      <header className="z-10 flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          ns://ui
        </span>
        <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / cursor-sixel-reveal
        </span>
      </header>
      {/* the window sweeps a Lissajous path at rest and eases to the
          pointer on hover — inside it, the field is a raw-pixel raster;
          outside, it's the same field quantized to ASCII glyphs */}
      <SixelReveal className="min-h-0 flex-1" />
      <footer className="z-10 flex items-center justify-between border-t border-border px-6 py-3">
        <span className="font-mono text-xs text-ns-muted">
          sixel/kitty raster vs. ASCII fallback, one field
        </span>
        <span className="font-mono text-xs text-ns-muted">
          hover to steer the window
        </span>
      </footer>
    </main>
  );
}
