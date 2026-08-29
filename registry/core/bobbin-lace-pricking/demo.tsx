"use client";

import { BobbinLacePricking } from "./component";

export default function BobbinLacePrickingDemo() {
  return (
    <div
      data-bobbin-lace-card
      className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16"
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / bobbin-lace-pricking
      </p>

      <div className="h-72 w-full max-w-sm overflow-hidden rounded-[16px] border border-border bg-background">
        <BobbinLacePricking />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        A working band twists each pin&apos;s threads into a locked cross, then pulls the pin two
        rows behind it once the crossing has set — pure ambient, no interaction.
      </p>
    </div>
  );
}
