"use client";

import { JacquardCardChain } from "./component";

export default function JacquardCardChainDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / jacquard-card-chain
      </p>

      <JacquardCardChain />

      <p className="max-w-md text-center text-xs text-ns-muted">
        A chain of punched cards feeds past a fixed reader; the needle bank ripples to each new
        card&apos;s pattern, holds, then the next card slides in. The program loops forever.
      </p>
    </div>
  );
}
