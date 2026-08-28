"use client";

import { GroovePitch } from "./component";

export default function GroovePitchDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / groove-pitch
      </p>

      <div
        data-groove-pitch-hero
        className="flex w-full max-w-md flex-col items-center gap-6 rounded-xl border border-border bg-surface px-10 py-12"
      >
        <GroovePitch label="Rendering export" />
        <p className="text-sm text-foreground">Rendering export</p>
        <p className="font-mono text-[11px] text-ns-muted">
          turn spacing widens and narrows like a cutting lathe under program level
        </p>
      </div>
    </main>
  );
}
