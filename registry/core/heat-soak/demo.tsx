"use client";

import { useState } from "react";
import { HeatSoak } from "./component";

export default function HeatSoakDemo() {
  const [count, setCount] = useState(0);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / heat-soak
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          Verification email
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Press repeatedly — the button itself swells, its letters spread and
          its border brightens with every send. Push it past its duty cycle
          and it soaks: presses go dead until it visibly cools back down.
        </p>

        <div className="mt-5 rounded-md border border-border bg-background p-5">
          <HeatSoak onPress={() => setCount((c) => c + 1)}>
            Resend verification email
          </HeatSoak>
        </div>

        <p className="mt-3 font-mono text-[11px] text-muted">
          sent {count} time{count === 1 ? "" : "s"}
        </p>
      </div>
    </main>
  );
}
