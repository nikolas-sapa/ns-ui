"use client";

import { GloryHoleCycle } from "./component";

// three realistic "still working" chips sitting where this pattern actually
// lives — a job list, a sync row, an inline status next to a filename — each
// looping independently on the same 4.0s reheat/cool beat, no input needed.
export default function GloryHoleCycleDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / glory-hole-cycle
      </p>

      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-background p-6">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-foreground">render-4k-master.mov</span>
          <GloryHoleCycle label="Encoding" />
        </div>
        <div className="h-px w-full bg-border" />
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-foreground">backup / nightly</span>
          <GloryHoleCycle label="Syncing" />
        </div>
        <div className="h-px w-full bg-border" />
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-foreground">index rebuild</span>
          <GloryHoleCycle label="Processing" />
        </div>
      </div>

      <p className="max-w-md text-center font-mono text-[10px] leading-relaxed text-ns-muted">
        a glory-hole reheat cycle — sharp reheat ramp, slow radiative cool,
        once every 4.0s, for as long as the work is still running
      </p>
    </div>
  );
}
