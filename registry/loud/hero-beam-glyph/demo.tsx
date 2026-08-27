"use client";

import { HeroBeamGlyph } from "./component";

export default function HeroBeamGlyphDemo() {
  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      <header className="z-10 flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          ns://ui
        </span>
        <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / hero-beam-glyph
        </span>
      </header>
      {/* the wordmark is drawn, not typeset — a vector beam retraces it 36
          times a second, glowing brighter at every corner it slows into */}
      <HeroBeamGlyph text="SIGNAL" className="min-h-0 flex-1">
        <p className="font-mono text-xs tracking-[0.2em] text-ns-muted">
          traced, not typeset
        </p>
      </HeroBeamGlyph>
      <footer className="z-10 flex items-center justify-between border-t border-border px-6 py-3">
        <span className="font-mono text-xs text-ns-muted">
          move near the wordmark to disturb the beam
        </span>
        <span className="font-mono text-xs text-ns-muted">
          vector stroke font / canvas
        </span>
      </footer>
    </main>
  );
}
