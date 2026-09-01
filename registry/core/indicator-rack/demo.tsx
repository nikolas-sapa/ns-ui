"use client";

import { IndicatorRack } from "./component";

// Card-scale demo: the rack at its default geometry with the default three
// placeholder plans and the default monthly/annual term. No props required —
// selecting a plan or term is what drives the sort; the meta.json `autoplay`
// descriptor presses through the plan radios on the deployed card so the
// crossing-plate motion is visible without a visitor's input.
export default function IndicatorRackDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / indicator-rack
      </p>

      <div className="ns-ir-demo-card w-full max-w-sm rounded-[16px] border border-border bg-background p-8">
        <IndicatorRack />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Select a plan or billing term — the old tablet drops as the new one
        rises, crossing mid-column.
      </p>
    </div>
  );
}
