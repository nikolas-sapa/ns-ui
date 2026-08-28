"use client";

import { DeltaFrameMacroblock } from "./component";

export default function DeltaFrameMacroblockDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-0 bg-background px-6">
      <div className="w-full max-w-3xl border-b border-border py-16">
        <p className="font-mono text-xs tracking-widest text-ns-muted">CHANGELOG</p>
        <h2 className="mt-3 text-2xl font-semibold text-foreground">
          Every release, only what moved
        </h2>
      </div>
      <div className="h-40 w-full max-w-3xl">
        <DeltaFrameMacroblock />
      </div>
      <div className="w-full max-w-3xl border-t border-border py-16">
        <p className="max-w-lg text-sm leading-relaxed text-ns-muted">
          ns-ui / delta-frame-macroblock — a quiet band sitting between sections. A
          small, capped subset of macroblocks is flagged as changed every 220ms
          tick; every other block is explicitly left untouched, same as a
          decoder skipping an unflagged P-frame block.
        </p>
      </div>
    </div>
  );
}
