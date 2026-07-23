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
          Press repeatedly — heat fills the button from the bottom, its
          letters spread, its border brightens and a haze shimmers across
          the surface as it nears the limit. Push it past its duty cycle
          and it soaks: a hazard hatch pulses, presses go dead, and the
          fill visibly drains back down as it cools.
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
