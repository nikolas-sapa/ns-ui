"use client";

import { ShimFit } from "./component";

export default function ShimFitDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">ns-ui / context-prompt-shims</p>

      <div className="w-full max-w-md rounded-md border border-border bg-surface px-6 py-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-foreground">Prompt composition</h2>
          <p className="mt-1 text-sm text-muted">
            Drag a row (or Space to grab, arrows to move, Space to drop) to reorder the
            prompt. Insert a retrieved doc from the tray — one fits, one doesn&apos;t.
          </p>
        </div>

        <ShimFit />
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        The clearance above the stack is real empty space, not a percentage. An
        over-budget insert compresses the stack, bounces back to the tray, and pulses
        the largest trimmable section with a fix.
      </p>
    </div>
  );
}
