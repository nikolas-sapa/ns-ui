"use client";

import { useState } from "react";
import { CatenarySplit } from "./component";

export default function CatenarySplitDemo() {
  const [ratio, setRatio] = useState(62);
  const [total, setTotal] = useState(58);

  const [trafficRatio, setTrafficRatio] = useState(35);
  const [trafficTotal, setTrafficTotal] = useState(100);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / slider-allocation-wire — the wire is the readout
      </p>

      <div className="w-full max-w-md rounded-md border border-border bg-surface p-6">
        <div className="mb-5">
          <h2 className="text-sm font-medium text-foreground">
            Cluster budget
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Drag the bead to shift the split. Scroll or drag the total track
            to winch how much of the budget is actually committed.
          </p>
        </div>

        <CatenarySplit
          leftLabel="Compute"
          rightLabel="Storage"
          ratio={ratio}
          onRatioChange={setRatio}
          total={total}
          onTotalChange={setTotal}
          className="cs-primary"
        />
      </div>

      <div className="w-full max-w-md rounded-md border border-border bg-surface p-6">
        <div className="mb-5">
          <h2 className="text-sm font-medium text-foreground">
            Traffic weighting
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Fully committed by default — the wire snaps taut with a decaying
            twang the moment total allocation lands at 100%.
          </p>
        </div>

        <CatenarySplit
          leftLabel="Primary"
          rightLabel="Canary"
          ratio={trafficRatio}
          onRatioChange={setTrafficRatio}
          total={trafficTotal}
          onTotalChange={setTrafficTotal}
        />
      </div>
    </div>
  );
}
