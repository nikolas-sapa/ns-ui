"use client";

import { OscilloCrest } from "./component";

export default function OscilloCrestDemo() {
  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      <header className="z-10 flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          ns://ui
        </span>
        <span className="font-mono text-xs tracking-[0.25em] text-muted">
          ns-ui / hero-oscilloscope
        </span>
      </header>
      {/* sweep across the trace — it rings where you touch it and settles
          back over about a second */}
      <OscilloCrest amplitude={0.62} frequency={2.4} className="min-h-0 flex-1">
        <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground/90 sm:text-4xl">
          SIGNAL, HELD STEADY
        </h1>
      </OscilloCrest>
      <footer className="z-10 flex items-center justify-between border-t border-border px-6 py-3">
        <span className="font-mono text-xs text-muted">
          drag across the field to excite it
        </span>
        <span className="font-mono text-xs text-muted">
          three harmonics / canvas
        </span>
      </footer>
    </main>
  );
}
