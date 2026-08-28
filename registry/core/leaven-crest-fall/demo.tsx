"use client";

import { LeavenCrestFall } from "./component";

export default function LeavenCrestFallDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / leaven-crest-fall</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          a starter jar rising and collapsing on its own 12.6s feed cycle
        </p>
      </header>
      <div className="flex min-h-[calc(100vh-3.75rem)] items-center justify-center p-8">
        <div className="h-[420px] w-[360px] rounded-lg border border-border">
          <LeavenCrestFall className="rounded-lg" />
        </div>
      </div>
    </main>
  );
}
