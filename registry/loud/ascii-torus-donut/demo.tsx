"use client";

import { TorusRender } from "./component";

export default function TorusRenderDemo() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          ns://ui
        </span>
        <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / ascii-torus-donut
        </span>
      </header>
      {/* drag to spin on both axes; release for inertia, it settles back
          into a slow idle spin */}
      <TorusRender className="min-h-0 flex-1" />
      <footer className="flex items-center justify-between border-t border-border px-6 py-3">
        <span className="font-mono text-xs text-ns-muted">
          drag to rotate — real depth buffer, Lambertian shading
        </span>
        <span className="font-mono text-xs text-ns-muted">
          zero deps / inline trig
        </span>
      </footer>
    </main>
  );
}
