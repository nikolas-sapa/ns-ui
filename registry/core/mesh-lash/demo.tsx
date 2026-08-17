"use client";

import { GearLashField } from "./component";

export default function GearLashFieldDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / mesh-lash</p>

      <div className="w-full max-w-sm rounded-[16px] border border-border bg-background p-5">
        <p className="mb-4 text-sm text-foreground">Send to a MXN account</p>
        <GearLashField fromCurrency="USD" toCurrency="MXN" rate={17.05} spreadFrac={0.012} defaultAmount={300} />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Type an amount, or drag the gears. Reverse direction and watch the drive gear turn through a
        dead angle before the driven gear picks up — that lost rotation is the spread.
      </p>
    </div>
  );
}
