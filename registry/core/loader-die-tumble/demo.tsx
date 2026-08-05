"use client";

import { HingeTopple } from "./component";

export default function HingeToppleDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-ns-muted">
        ns-ui / loader-die-tumble
      </p>

      <div
        data-loader-die-tumble-hero
        className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border border-border bg-surface px-10 py-14"
      >
        <HingeTopple size={64} label="Syncing workspace" />
        <p className="text-center text-sm text-foreground">Syncing workspace…</p>
      </div>

      <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
        <HingeTopple size={22} label="Loading" />
        <span className="text-xs text-ns-muted">inline, at 22px</span>
      </div>

      <p className="max-w-sm text-center font-mono text-[10px] text-ns-muted">
        each landing overshoots ~8deg then corrects on a spring — never a clean stop
      </p>
    </main>
  );
}
