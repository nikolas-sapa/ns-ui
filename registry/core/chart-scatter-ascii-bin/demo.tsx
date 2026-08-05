"use client";

import { ChartScatterAsciiBin } from "./component";

export default function ChartScatterAsciiBinDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / chart-scatter-ascii-bin
        </p>
        <div className="rounded-md border border-border bg-surface p-5">
          <ChartScatterAsciiBin title="Synthetic sample A/B" />
        </div>
      </div>
    </main>
  );
}
