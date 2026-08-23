"use client";

import { FuseeCone } from "./component";

export default function FuseeConeDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">ns-ui / fusee-cone</p>
        <h1 className="text-lg font-semibold text-foreground">Burn-rate alert policy</h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          Drag the 4 control points to author how sensitive alerting gets as error budget
          depletes — the cone tapers toward the empty end because a control point can never be
          raised above the one before it. The table on the right is the rule set that shape
          implies; Replay streams a recorded burn history and stamps where it would have tripped.
        </p>

        <div className="mt-5 rounded-md border border-border p-5">
          <FuseeCone label="Checkout latency SLO" />
        </div>
      </div>
    </main>
  );
}
