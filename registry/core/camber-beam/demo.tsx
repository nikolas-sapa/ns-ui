"use client";

import { useEffect, useState } from "react";
import { CamberBeam, type CamberBeamStatus } from "./component";

// A self-driving health cycle — no pointer or keyboard input in the loop —
// because the real job here is ambient: a dashboard's status line should
// tell its own story over time without anyone touching it. This is the same
// "realistic case" shape as beacon-cadence's demo: an app narrating its own
// state, cycled on a timer.
const RUN: { status: CamberBeamStatus; severity?: number; ms: number }[] = [
  { status: "healthy", ms: 3200 },
  { status: "degraded", severity: 0.22, ms: 2200 },
  { status: "degraded", severity: 0.55, ms: 2200 },
  { status: "degraded", severity: 0.92, ms: 2000 },
  { status: "down", ms: 3400 },
  { status: "degraded", severity: 0.4, ms: 2200 },
  { status: "healthy", ms: 2600 },
];

export default function CamberBeamDemo() {
  const [step, setStep] = useState(0);
  const active = RUN[step % RUN.length]!;

  useEffect(() => {
    const t = window.setTimeout(() => setStep((s) => s + 1), active.ms);
    return () => window.clearTimeout(t);
  }, [step, active.ms]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / camber-beam
      </p>

      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface">
        <CamberBeam status={active.status} severity={active.severity} />

        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="font-mono text-xs font-medium text-foreground">Dashboard</span>
          <div className="flex gap-4">
            <span className="text-xs text-muted">Overview</span>
            <span className="text-xs text-muted">Deploys</span>
            <span className="text-xs text-muted">Logs</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 px-5 py-6">
          <div className="h-2.5 w-3/4 rounded-full bg-border" />
          <div className="h-2.5 w-1/2 rounded-full bg-border" />
          <div className="h-2.5 w-5/6 rounded-full bg-border" />
        </div>
      </div>

      <p className="max-w-md text-center font-mono text-[10px] text-muted">
        healthy is a flat, near-invisible rule — it bows further as severity rises,
        and only fractures with a text row on an actual outage
      </p>
    </div>
  );
}
