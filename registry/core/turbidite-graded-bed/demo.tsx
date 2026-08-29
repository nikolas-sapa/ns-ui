"use client";

import { TurbiditeGradedBed } from "./component";

export default function TurbiditeGradedBedDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / turbidite-graded-bed</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          one graded bed per flow pulse, coarse base to fine cap, stacking forever
        </p>
      </header>
      <div className="mx-auto flex max-w-5xl items-center justify-center px-6 py-16">
        <div className="h-[420px] w-[280px] overflow-hidden rounded-sm border border-border">
          <TurbiditeGradedBed className="h-full w-full" />
        </div>
      </div>
    </main>
  );
}
