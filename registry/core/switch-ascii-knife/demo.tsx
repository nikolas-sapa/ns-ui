"use client";

import { useState } from "react";
import { ThrowSwitch } from "./component";

export default function ThrowSwitchDemo() {
  const [power, setPower] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / switch-ascii-knife
      </p>
      <div className="flex flex-col items-center gap-4 rounded-md border border-border bg-surface px-10 py-8">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
          main power
        </span>
        <ThrowSwitch
          checked={power}
          onCheckedChange={setPower}
          aria-label="Main power"
          className="text-2xl sm:text-3xl"
        />
      </div>
      <p className="max-w-md text-center text-xs text-muted">
        Space or Enter throws the switch; the blade fills one cell at a time
        and the handle spins mid-transit.
      </p>
    </div>
  );
}
