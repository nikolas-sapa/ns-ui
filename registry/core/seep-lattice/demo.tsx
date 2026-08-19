"use client";

import { useState } from "react";
import { SeepLattice } from "./component";

export default function SeepLatticeDemo() {
  const [rollout, setRollout] = useState(35);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / seep-lattice — blast radius, not a percentage
      </p>

      <div className="w-full max-w-md rounded-md border border-border bg-background p-6">
        <div className="mb-5">
          <h2 className="text-sm font-medium text-foreground">
            checkout-v2 rollout
          </h2>
          <p className="mt-0.5 text-xs text-ns-muted">
            Drag to set the rollout percentage. The lattice cell each
            traffic segment lands in is fixed at mount — dragging only
            reveals or hides the front, it never reshuffles.
          </p>
        </div>

        <SeepLattice rollout={rollout} onRolloutChange={setRollout} />
      </div>
    </div>
  );
}
