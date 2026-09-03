"use client";

import { FlyingSplice } from "./component";

export default function FlyingSpliceDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-32 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / flying-splice</p>

      <div className="ns-fs-card h-[220px] w-full max-w-2xl rounded-[12px] border border-border">
        <FlyingSplice />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        The roll shrinks and spins up as it empties, then rebuilds to full and slows back down.
        One continuous 22s oscillation, never a reset.
      </p>
    </div>
  );
}
