"use client";

import { SpecieClip } from "./component";

export default function SpecieClipDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / specie-clip — the cut is the number
      </p>

      <div className="w-full max-w-sm rounded-md border border-border bg-background p-6">
        <div className="mb-5">
          <h2 className="text-sm font-medium text-foreground">
            Issue partial refund
          </h2>
          <p className="mt-0.5 text-xs text-ns-muted">
            Drag the chord across the coin, or type an amount. Clipping the
            chord free is the refund — nothing moves until you press Refund.
          </p>
        </div>

        <SpecieClip
          defaultChargeAmount={120}
          defaultRefundFrac={0.25}
          currencySymbol="$"
        />
      </div>
    </div>
  );
}
