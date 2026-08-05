"use client";

import { useRef } from "react";
import { TorsionRetry } from "./component";

export default function TorsionWindDemo() {
  // deterministic flaky-network simulation: fails 3 times in a row, then
  // succeeds once, forever cyclic — no randomness, so the retry episode
  // (wind, notch, wind again, charge, succeed, reset) is reproducible.
  const calls = useRef(0);

  const onRetry = async () => {
    calls.current += 1;
    await new Promise((resolve) => setTimeout(resolve, 150));
    return calls.current % 4 === 0;
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / button-retry-backoff — rate-limited retry
      </p>
      <TorsionRetry
        onRetry={onRetry}
        baseDelayMs={1000}
        factor={1.8}
        maxDelayMs={4000}
      />
    </div>
  );
}
