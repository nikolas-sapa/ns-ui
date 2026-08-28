"use client";

import { MeltPondDrain } from "./component";

export default function MeltPondDrainDemo() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / melt-pond-drain</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          fills, drains through a new crack, refills — unbound, ambient
        </p>
      </header>
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="aspect-[4/3] w-full max-w-sm rounded-lg border border-border bg-surface p-4">
          <MeltPondDrain />
        </div>
      </div>
    </main>
  );
}
