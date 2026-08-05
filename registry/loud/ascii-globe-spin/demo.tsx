"use client";

import { MeridianSpin } from "./component";

export default function MeridianSpinDemo() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          ns://ui
        </span>
        <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / ascii-globe-spin
        </span>
      </header>
      {/* drag horizontally to spin the globe; hover to read the lat/lon
          under the cursor in the frame */}
      <MeridianSpin className="min-h-0 flex-1" />
      <footer className="flex items-center justify-between border-t border-border px-6 py-3">
        <span className="font-mono text-xs text-ns-muted">
          drag to spin — terminator sweeps with rotation
        </span>
        <span className="font-mono text-xs text-ns-muted">
          coarse land mask / zero deps
        </span>
      </footer>
    </main>
  );
}
