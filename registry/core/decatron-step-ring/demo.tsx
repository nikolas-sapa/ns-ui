"use client";

import { DecatronStepRing } from "./component";

export default function DecatronStepRingDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / decatron-step-ring</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          a glow steps around ten stations, stretching onto the guide electrode before it snaps home
        </p>
      </header>
      <div className="flex min-h-[calc(100vh-3.75rem)] items-center justify-center px-6 py-16">
        <div className="w-full max-w-xs rounded-md border border-border bg-surface p-8">
          <DecatronStepRing />
          <p className="mt-6 text-center text-xs text-ns-muted">
            free-running decade counter — no input, ten stations, 14s per lap
          </p>
        </div>
      </div>
    </main>
  );
}
