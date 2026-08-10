"use client";

import { GrainCrestTable } from "./component";

export default function GrainCrestTableDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / grain-crest
        </p>

        <GrainCrestTable />

        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          each header's braille strip is that column's own distribution — click to
          sort, hover a strip for the bin under your pointer
        </p>
      </div>
    </main>
  );
}
