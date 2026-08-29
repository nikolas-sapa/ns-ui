"use client";

import { SlumpMouldDrape } from "./component";

export default function SlumpMouldDrapeDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / slump-mould-drape
      </p>

      <div className="w-full max-w-sm rounded-xl border border-border bg-surface px-6 py-7">
        <div className="mb-5 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ns-muted">
            kiln cycle
          </span>
        </div>
        <div className="h-40 w-full">
          <SlumpMouldDrape />
        </div>
      </div>

      <p className="max-w-xs text-center font-mono text-[10px] text-ns-muted">
        the centre sags first — the drape spreads toward the edges over 4.5s,
        holds, then lifts flat for the next blank
      </p>
    </div>
  );
}
