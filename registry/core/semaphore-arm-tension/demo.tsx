"use client";

import { useState } from "react";
import { SemaphoreArmTension } from "./component";

export default function SemaphoreArmTensionDemo() {
  // starts Clear — the "wire under tension" state — so the idle card shows
  // the arm lowered and the lamp near peak from the first paint, matching
  // the reduced-motion freeze frame's most-structured read.
  const [cleared, setCleared] = useState(true);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-xs">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / semaphore-arm-tension
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          Deploy gate — checkout-service
        </h1>
        <p className="mt-1 max-w-xs text-sm leading-relaxed text-ns-muted">
          Position is the state: the arm hangs at Danger by gravity and only
          reaches Clear when the wire is under tension. It never fully
          stops — the tip rides a slow breathing cycle and the lamp drifts
          like a real flame, independent of whichever state it's holding.
        </p>

        <div className="mt-5 rounded-md border border-border bg-surface p-5">
          <SemaphoreArmTension
            label="Deploy gate"
            cleared={cleared}
            onClearedChange={setCleared}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border px-5 py-3">
          <span className="font-mono text-[11px] text-ns-muted">
            toggle the gate manually
          </span>
          <button
            type="button"
            onClick={() => setCleared((c) => !c)}
            className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-ns-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            {cleared ? "SET DANGER" : "SET CLEAR"}
          </button>
        </div>

        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          arm position is the only signal — no colour ever carries the state
        </p>
      </div>
    </main>
  );
}
