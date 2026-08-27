"use client";

import { RollerOcclusion } from "./component";

export default function RollerOcclusionDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / roller-occlusion
      </p>

      <div
        data-roller-hero
        className="flex w-full max-w-md flex-col gap-5 rounded-xl border border-border bg-surface p-6"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-foreground">Syncing embeddings</p>
          <p className="font-mono text-[11px] text-ns-muted">3 workers · continuous</p>
        </div>

        <div className="h-40 w-full">
          <RollerOcclusion label="Embedding sync pump active" />
        </div>

        <p className="font-mono text-[11px] text-ns-muted">
          hover the tube — the rotor spins up while you do
        </p>
      </div>

      <div className="flex w-full max-w-md flex-col gap-2">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ns-muted">
          card scale, borderless
        </p>
        <div className="h-24 w-full">
          <RollerOcclusion label="Ingest pipeline running" className="border-transparent bg-transparent" />
        </div>
      </div>
    </main>
  );
}
