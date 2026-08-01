"use client";

import { useEffect, useRef, useState } from "react";
import { PacketTrace, type PacketTraceState } from "./component";

// Self-driving loop through the three traffic states so a screenshot pass
// catches idle, dense-active, and the error queue building up at the hub.
const SCRIPT: { state: PacketTraceState; ms: number }[] = [
  { state: "idle", ms: 3200 },
  { state: "active", ms: 4200 },
  { state: "error", ms: 4200 },
];

export default function PacketTraceDemo() {
  const [step, setStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const current = SCRIPT[step % SCRIPT.length]!;

  useEffect(() => {
    timerRef.current = setTimeout(() => setStep((s) => s + 1), current.ms);
    return () => clearTimeout(timerRef.current);
  }, [step, current.ms]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / network-packet-trace
      </p>

      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-[12px] border border-border bg-background p-6">
        <PacketTrace state={current.state} />
        <p className="font-mono text-[11px] uppercase tracking-wide text-muted">
          state: {current.state}
        </p>
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Pulses branch across the network at random; in the error state they
        route toward the hub node and stack up instead of dispersing. Hover
        or focus a node for its live throughput.
      </p>
    </div>
  );
}
