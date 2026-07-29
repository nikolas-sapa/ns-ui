"use client";

import { BladeIris } from "./component";

export default function BladeIrisDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">
        ns-ui / blade-iris
      </p>

      <div
        data-blade-iris-hero
        className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border border-border bg-surface px-10 py-14"
      >
        <BladeIris size={72} label="Rendering export" />
        <p className="text-center text-sm text-foreground">Rendering export…</p>
      </div>

      <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
        <BladeIris size={20} label="Loading" />
        <span className="text-xs text-muted">inline, at 20px</span>
      </div>

      <p className="max-w-sm text-center font-mono text-[10px] text-muted">
        six wedges, one shared shape — the hex opening is only their tips moving in unison
      </p>
    </main>
  );
}
