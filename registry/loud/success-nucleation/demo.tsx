"use client";

import { useState } from "react";
import { SeedCrystal } from "./component";

export default function SeedCrystalDemo() {
  const [resetKey, setResetKey] = useState(0);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / success-nucleation
      </p>
      <SeedCrystal
        key={resetKey}
        className="w-full max-w-sm"
        pendingMs={900}
        onConfirm={() => {
          // real usage: return the async call itself (payment API, deploy,
          // publish). This demo just resets the card a beat after the
          // crystal settles so the moment can be replayed.
          window.setTimeout(() => setResetKey((k) => k + 1), 2600);
        }}
      />
    </div>
  );
}
