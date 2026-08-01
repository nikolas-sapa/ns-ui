"use client";

import { CounterpoiseTiers } from "./component";

export default function CounterpoiseTiersDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-4xl">
        <p className="mb-10 text-center font-mono text-xs tracking-widest text-muted">
          ns-ui / pricing-scale
        </p>
        <div className="mx-auto mb-10 max-w-xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Pricing that weighs itself
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Two plans on a real balance beam. Flip the billing period, tick
            features on and off, and watch which side the physics comes down
            on.
          </p>
        </div>
        <CounterpoiseTiers />
        <p className="mt-10 text-center font-mono text-[11px] text-muted">
          Prices in USD, taxes not included. The beam has no sales quota.
        </p>
      </div>
    </main>
  );
}
