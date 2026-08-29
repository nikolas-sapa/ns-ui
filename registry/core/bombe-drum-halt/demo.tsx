"use client";

import { BombeDrumHalt } from "./component";

export default function BombeDrumHaltDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / bombe-drum-halt</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          drums scan continuously, halt every 4-6s while a check runs, then resume
        </p>
      </header>
      <div className="flex min-h-[calc(100vh-3.75rem)] items-center justify-center p-10">
        <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-xl border border-border bg-surface p-10">
          <BombeDrumHalt className="h-64 w-64" label="Searching rotor positions" />
          <p className="text-center font-mono text-[11px] text-ns-muted">
            no known endpoint or percentage — an ambient search indicator, not a progress bar
          </p>
        </div>
      </div>
    </main>
  );
}
