"use client";

import { SemaphoreArmCast } from "./component";

export default function SemaphoreArmCastDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / semaphore-arm-cast</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          two arms relay a new symbol roughly every 2.15s
        </p>
      </header>
      <div className="flex min-h-[calc(100vh-3.75rem)] items-center justify-center p-8">
        <div className="h-80 w-80 max-w-full rounded-xl border border-border">
          <SemaphoreArmCast />
        </div>
      </div>
    </main>
  );
}
