"use client";

import { FacerStampFlip } from "./component";

export default function FacerStampFlipDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / facer-stamp-flip</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          mixed-orientation envelopes face at a fixed gate, then continue on
        </p>
      </header>
      <div className="flex min-h-[calc(100vh-3.75rem)] items-center justify-center p-10">
        <div className="flex w-full max-w-2xl flex-col items-center gap-6 rounded-xl border border-border bg-surface p-10">
          <FacerStampFlip className="h-48 w-full" label="Normalizing uploaded files" />
          <p className="text-center font-mono text-[11px] text-ns-muted">
            no known total or percentage — continuous batch throughput, not a progress bar
          </p>
        </div>
      </div>
    </main>
  );
}
