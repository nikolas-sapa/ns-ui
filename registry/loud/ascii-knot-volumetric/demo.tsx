"use client";

import { KnotRender } from "./component";

export default function KnotRenderDemo() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          ns://ui
        </span>
        <span className="font-mono text-xs tracking-[0.25em] text-muted">
          ns-ui / ascii-knot-volumetric
        </span>
      </header>
      {/* drag to spin on both axes; the tube's own crossings resolve
          correctly from any angle via the same depth buffer that shades it */}
      <KnotRender className="min-h-0 flex-1" />
      <footer className="flex items-center justify-between border-t border-border px-6 py-3">
        <span className="font-mono text-xs text-muted">
          drag to rotate — volumetric tube, Frenet frame, real crossings
        </span>
        <span className="font-mono text-xs text-muted">zero deps / inline trig</span>
      </footer>
    </main>
  );
}
