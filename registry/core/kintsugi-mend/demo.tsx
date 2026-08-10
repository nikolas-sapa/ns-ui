"use client";

import { useRef, useState } from "react";
import { KintsugiMend } from "./component";

function LatencyPanel() {
  const bars = [22, 26, 24, 30, 28, 34, 31, 27, 33, 29, 25, 31];
  return (
    <div className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Realtime latency</p>
        <span className="font-mono text-xs text-ns-muted">p50 · 30s window</span>
      </div>
      <div className="mt-4 flex h-20 items-end gap-1.5">
        {bars.map((v, i) => (
          <div
            key={i}
            aria-hidden
            className="flex-1 rounded-t-sm bg-foreground/15"
            style={{ height: `${v * 2.4}px` }}
          />
        ))}
      </div>
      <p className="mt-3 font-mono text-xs text-ns-muted">28ms avg · socket resynced</p>
    </div>
  );
}

export default function KintsugiMendDemo() {
  const [status, setStatus] = useState<"ok" | "error">("ok");
  const [retries, setRetries] = useState(1);
  const busyRef = useRef(false);

  const simulateOutage = () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStatus("error");
    const attempts = 2 + Math.floor(Math.random() * 3);
    window.setTimeout(() => {
      setRetries(attempts);
      setStatus("ok");
      busyRef.current = false;
    }, 900);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-20 text-foreground">
      <div className="w-full max-w-md">
        <p className="font-mono text-xs uppercase tracking-widest text-ns-muted">ns-ui / kintsugi-mend</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Recovery leaves a mark</h1>
        <p className="mt-2 text-sm leading-relaxed text-ns-muted">
          This panel recovered from a network error two minutes ago. The hairline seams are the
          crack it broke along — each one is a focusable hotspot with the full incident behind it.
        </p>

        <div className="mt-8">
          <KintsugiMend
            status={status}
            subject="chart"
            reason="network error"
            retries={retries}
            initialIncident={{
              reason: "network error",
              retries: 3,
              recoveredAt: Date.now() - 2 * 60 * 1000,
            }}
            seed={7}
          >
            <LatencyPanel />
          </KintsugiMend>
        </div>

        <button
          type="button"
          onClick={simulateOutage}
          className="mt-6 rounded-sm border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground outline-none transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Simulate outage
        </button>
        <p className="mt-3 max-w-md text-xs leading-relaxed text-ns-muted">
          Simulating an outage shatters the panel along the same crack, then springs it back with
          a slight overshoot on recovery — refreshing the seams to full brightness. Tab to a seam
          and press Enter (or click one) to see the incident it remembers.
        </p>
      </div>
    </div>
  );
}
