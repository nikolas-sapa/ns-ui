"use client";

import { ShutterTelegraphBoard } from "./component";

export default function ShutterTelegraphBoardDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / shutter-telegraph-board</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          a new symbol flips into the board every couple of seconds
        </p>
      </header>
      <div className="mx-auto max-w-2xl px-6 py-16">
        <ShutterTelegraphBoard className="h-56 rounded-md border border-border bg-surface" />
      </div>
    </main>
  );
}
