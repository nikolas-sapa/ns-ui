"use client";

import { useEffect, useState } from "react";
import { BeaconCadence, type BeaconCadenceState } from "./component";

// the active run cycles through the full cadence lifecycle on its own —
// this is the realistic case: an agent narrating its own progress, no
// pointer or keyboard input in the loop at all.
const RUN: { state: BeaconCadenceState; text: string; ms: number }[] = [
  { state: "working", text: "Solving the integral…", ms: 2600 },
  { state: "searching", text: "Searching prior runs…", ms: 2400 },
  { state: "blocked", text: "Blocked — rate limited", ms: 2200 },
  { state: "awaiting-input", text: "Awaiting your input", ms: 2600 },
  { state: "working", text: "Applying the fix…", ms: 2200 },
  { state: "done", text: "Task complete", ms: 3200 },
];

// fixed reference rows -- all five states, always on screen regardless of
// where the cycling hero above happens to land, so the full cadence set is
// visible in a single still frame (not just whichever state fired last).
const RUNS: { state: BeaconCadenceState; text: string; time: string }[] = [
  { state: "working", text: "Refactoring auth middleware", time: "0:18" },
  { state: "searching", text: "Indexing changelog", time: "0:41" },
  { state: "blocked", text: "Missing API key", time: "1:12" },
  { state: "awaiting-input", text: "Confirm before deploy", time: "2:03" },
  { state: "done", text: "Nightly backup", time: "6:00" },
];

export default function BeaconCadenceDemo() {
  const [step, setStep] = useState(0);
  const active = RUN[step % RUN.length]!;

  useEffect(() => {
    const t = window.setTimeout(() => setStep((s) => s + 1), active.ms);
    return () => window.clearTimeout(t);
  }, [step, active.ms]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-12 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / status-glyph-cadence
      </p>

      <div className="w-full max-w-sm rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-4 border-b border-border px-5 py-5">
          <BeaconCadence state={active.state} size={60} />
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{active.text}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ns-muted">
              current run
            </p>
          </div>
        </div>

        <ul className="flex flex-col divide-y divide-border">
          {RUNS.map((row) => (
            <li key={row.text} className="flex items-center gap-3 px-5 py-3">
              <BeaconCadence state={row.state} size={20} />
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                {row.text}
              </span>
              <span className="font-mono text-[10px] text-ns-muted">
                {row.time}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="font-mono text-[10px] text-ns-muted">
        motion is the signal — five distinct cadences, no color, no swapped icon
      </p>
    </div>
  );
}
