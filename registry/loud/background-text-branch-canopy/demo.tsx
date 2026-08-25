"use client";

import { BackgroundTextBranchCanopy } from "./component";

export default function BackgroundTextBranchCanopyDemo() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        <BackgroundTextBranchCanopy />
      </div>
      {/* content docked in the bottom reading zone the component's own scrim protects */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-10 text-left">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / background-text-branch-canopy
        </p>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground">
          A crown grown from language
        </h1>
        <p className="max-w-sm text-sm text-ns-muted">
          Every limb is a run of readable words, not a stroke — pivoting on
          its own foot as the canopy grows, sways, and sheds forever.
        </p>
      </div>
    </div>
  );
}
