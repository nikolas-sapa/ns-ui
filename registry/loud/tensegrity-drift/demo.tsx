"use client";

import { TensegrityDrift } from "./component";

export default function TensegrityDriftDemo() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-background px-6 py-16">
      <p className="absolute left-8 top-8 font-mono text-xs uppercase tracking-widest text-muted">
        ns-ui / tensegrity-drift
      </p>

      <div className="w-full max-w-4xl">
        <TensegrityDrift className="h-[560px]" />
      </div>

      <p className="max-w-md text-center text-sm text-muted">
        Drag any card. Its cables stretch taut, the strain runs through the
        network, and everything rings back down into a new equilibrium.
      </p>

      <p className="absolute bottom-8 left-8 font-mono text-xs text-muted">
        drag · arrow keys nudge · enter opens
      </p>
    </div>
  );
}
