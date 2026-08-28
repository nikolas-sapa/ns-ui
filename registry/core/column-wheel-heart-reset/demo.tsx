"use client";

import { ColumnWheelHeartReset } from "./component";

// The column-wheel/heart-cam cycle is the unconditional idle animation
// from mount — the demo needs nothing beyond mounting the chip itself
// inside a card, matching the surface it's meant to sit on (a save/confirm
// row).
export default function ColumnWheelHeartResetDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / column-wheel-heart-reset
      </p>

      <div className="flex w-full max-w-sm items-center justify-between rounded-[12px] border border-border bg-background px-4 py-3">
        <span className="text-sm text-foreground">Document saved</span>
        <ColumnWheelHeartReset size={72} />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        A chronograph column wheel indexes through a run, then a heart-cam
        hammer snaps the needle back to exactly zero on contact, holds, and
        indexes into the next run.
      </p>
    </div>
  );
}
