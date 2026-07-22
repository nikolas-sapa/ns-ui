"use client";

import { useState } from "react";
import { BarrelBolt, type BarrelBoltDecision } from "./component";

export default function BarrelBoltDemo() {
  const [log, setLog] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"pending" | "denied" | "granted">(
    "pending"
  );

  const handleDecide = (decision: BarrelBoltDecision) => {
    setOutcome(decision.outcome === "denied" ? "denied" : "granted");
    if (decision.outcome === "denied") {
      setLog("Denied — build-agent-07 was not granted shell access.");
    } else {
      setLog(
        `Granted (${decision.scope}) — build-agent-07 may run shell commands${
          decision.scope === "always"
            ? " indefinitely."
            : decision.scope === "session"
              ? " for this session."
              : " once."
        }`
      );
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / barrel-bolt — drag the bolt, or focus it and use arrow keys + Enter
      </p>

      <div className="w-full max-w-md rounded-md border border-border bg-background p-6">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            Permission request
          </p>
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
            {outcome}
          </span>
        </div>

        <BarrelBolt
          capability="run shell command"
          context="requested by build-agent-07"
          defaultValue="once"
          onDecide={handleDecide}
        />

        <p className="mt-6 min-h-[1.25rem] font-mono text-[11px] text-muted">
          {log ?? "No decision yet."}
        </p>
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Once sits a short drag away; This session and Always sit progressively
        further, through progressively heavier resistance — the distance you
        travel is the size of the grant. Release and the bolt seats itself;
        Deny sits outside the track entirely, so refusing is never a slider
        position you could overshoot into.
      </p>
    </div>
  );
}
