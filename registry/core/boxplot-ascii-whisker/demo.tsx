"use client";

import { BoxplotAsciiWhisker } from "./component";

export default function BoxplotAsciiWhiskerDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / boxplot-ascii-whisker
        </p>
        <div className="rounded-md border border-border bg-surface p-5">
          <BoxplotAsciiWhisker title="Synthetic batch spread" />
        </div>
      </div>
    </main>
  );
}
