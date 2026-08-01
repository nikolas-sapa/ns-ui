"use client";

import { GlyphTide } from "./component";

export default function GlyphTideDemo() {
  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      <header className="z-10 flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          ns://ui
        </span>
        <span className="font-mono text-xs tracking-[0.25em] text-muted">
          ns-ui / glyph-tide
        </span>
      </header>
      {/* drag across the field — it pushes outward from the cursor and
          relaxes back over a second or two */}
      <GlyphTide className="min-h-0 flex-1" />
      <footer className="z-10 flex items-center justify-between border-t border-border px-6 py-3">
        <span className="font-mono text-xs text-muted">
          drag to disturb the field
        </span>
        <span className="font-mono text-xs text-muted">
          three octaves / value noise
        </span>
      </footer>
    </main>
  );
}
