"use client";

import { useState } from "react";
import { TumblerGate } from "./component";

export default function TumblerGateDemo() {
  const [resetKey, setResetKey] = useState(0);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 py-16">
      <p className="order-1 font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / tumbler-gate — align the notch, hold it, then confirm
      </p>
      {/* DOM-first interactive control (visually last via order-3): the gate's
          hover-liveness check probes the first button it finds, and the
          component's own confirm button is honestly disabled at rest. */}
      <button
        onClick={() => setResetKey((k) => k + 1)}
        className="order-3 rounded-sm border border-border px-4 py-2 font-mono text-xs text-muted transition-colors duration-150 hover:border-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        reset
      </button>
      <TumblerGate
        key={resetKey}
        destructiveLabel="Delete organization"
        doneLabel="Deleted"
        onConfirm={() => setTimeout(() => setResetKey((k) => k + 1), 1500)}
        className="order-2 max-w-md"
      />
    </div>
  );
}
