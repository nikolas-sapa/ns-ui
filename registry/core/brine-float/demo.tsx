"use client";

import { BrineFloat } from "./component";

export default function BrineFloatDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-4xl">
        <p className="mb-10 text-center font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / brine-float
        </p>
        <div className="mx-auto mb-10 max-w-xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Pricing that finds its own level
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ns-muted">
            One shallow tank, three floats. Flip the billing period and feel
            every plan settle to a new depth, not just a new number.
          </p>
        </div>
        <BrineFloat />
        <p className="mt-10 text-center font-mono text-[11px] text-ns-muted">
          Prices in USD. The tank does not care which one you pick.
        </p>
      </div>
    </main>
  );
}
