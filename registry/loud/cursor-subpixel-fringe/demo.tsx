"use client";

import { SubpixelFringe } from "./component";

export default function SubpixelFringeDemo() {
  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      <header className="z-10 flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          ns://ui
        </span>
        <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / cursor-subpixel-fringe
        </span>
      </header>
      {/* three luminance slivers per cell stand in for LCD's RGB stripe
          triad; they splay and diverge in value near the cursor (or the
          idle sweep target), and shimmer everywhere at rest */}
      <SubpixelFringe className="min-h-0 flex-1" />
      <footer className="z-10 flex items-center justify-between border-t border-border px-6 py-3">
        <span className="font-mono text-xs text-ns-muted">
          LCD subpixel stripes, re-hinted in luminance only
        </span>
        <span className="font-mono text-xs text-ns-muted">
          move the cursor to splay the field
        </span>
      </footer>
    </main>
  );
}
