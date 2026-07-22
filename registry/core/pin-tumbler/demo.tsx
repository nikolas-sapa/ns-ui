"use client";

import { useState } from "react";
import { PinTumbler } from "./component";

const SHIPPING = [
  { value: "standard", label: "Standard", description: "5-7 business days" },
  { value: "expedited", label: "Expedited", description: "2-3 business days" },
  { value: "overnight", label: "Overnight", description: "Next business day" },
  { value: "same-day", label: "Same day", description: "Delivered by 8pm today" },
];

const ENVIRONMENTS = [
  { value: "dev", label: "Development" },
  { value: "staging", label: "Staging" },
  { value: "prod", label: "Production" },
];

export default function PinTumblerDemo() {
  const [shipping, setShipping] = useState("standard");
  const [env, setEnv] = useState("staging");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / pin-tumbler — one pin, exactly one choice
      </p>

      <div className="grid w-full max-w-2xl gap-6 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-background p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Shipping speed
          </h2>
          <p className="mt-1 text-xs text-muted">
            Farther choices, longer trip along the rail.
          </p>
          <div className="mt-4">
            <PinTumbler
              label="Shipping speed"
              options={SHIPPING}
              value={shipping}
              onValueChange={setShipping}
            />
          </div>
        </div>

        <div className="rounded-md border border-border bg-background p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Deploy target
          </h2>
          <p className="mt-1 text-xs text-muted">
            Three environments, one armed at a time.
          </p>
          <div className="mt-4">
            <PinTumbler
              label="Deploy target"
              options={ENVIRONMENTS}
              value={env}
              onValueChange={setEnv}
            />
          </div>
        </div>
      </div>

      <p aria-live="polite" className="font-mono text-xs text-muted">
        shipping / {shipping} &middot; env / {env}
      </p>

      <p className="max-w-md text-center text-xs text-muted">
        Click a row, or focus the group and use arrow keys. The line
        stretches toward whatever row you pick, then settles back to its
        resting length — no bounce. Reduced motion teleports it.
      </p>
    </div>
  );
}
