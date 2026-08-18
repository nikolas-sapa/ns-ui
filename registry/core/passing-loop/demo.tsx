"use client";

import { useState } from "react";
import { PassingLoop } from "./component";

export default function PassingLoopDemo() {
  const [lastEvent, setLastEvent] = useState("parked at the loop — confirm the canary to continue");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / passing-loop
        </p>
        <h1 className="text-lg font-semibold text-foreground">Rollout — checkout-service</h1>
        <p className="mt-1 max-w-xs text-sm leading-relaxed text-ns-muted">
          One cable, two cars. New climbs as old descends — the shares can
          never disagree. The loop holds at 50% until canary is confirmed;
          rollback releases the winch and lets it fall.
        </p>

        <div className="mt-6 rounded-md border border-border p-5">
          <PassingLoop
            newVersion="v2.4.1"
            oldVersion="v2.4.0"
            totalRequests={24000}
            defaultValue={0.5}
            ariaLabel="checkout-service traffic split"
            onCanaryConfirm={() => setLastEvent("canary confirmed — points open")}
            onRollback={(fromShare) =>
              setLastEvent(`rollback released at ${Math.round(fromShare * 100)}% on new`)
            }
            onValueChange={(v) => {
              if (v === 0.5) setLastEvent("parked at the loop — confirm the canary to continue");
            }}
          />
        </div>

        <p className="mt-3 font-mono text-[11px] text-ns-muted">{lastEvent}</p>
      </div>
    </main>
  );
}
