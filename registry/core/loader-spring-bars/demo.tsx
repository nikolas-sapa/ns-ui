"use client";

import { LathRack } from "./component";

export default function LathRackDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">
        ns-ui / loader-spring-bars
      </p>

      <div
        data-loader-spring-bars-hero
        className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border border-border bg-surface px-10 py-14"
      >
        <LathRack count={7} height={56} label="Transcribing audio" />
        <p className="text-center text-sm text-foreground">Transcribing audio…</p>
      </div>

      <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
        <LathRack count={4} height={18} label="Loading" />
        <span className="text-xs text-muted">inline, at 18px</span>
      </div>

      <p className="max-w-sm text-center font-mono text-[10px] text-muted">
        one shared spring pulse, staggered per lath — a wave, not five bars animating alone
      </p>
    </main>
  );
}
