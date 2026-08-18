"use client";

import { useEffect, useState } from "react";
import { RunningBelay, type BelayStage } from "./component";

// A realistic five-stage canary rollout: build, canary, 10%, 50%, 100%.
// Everything up through 10% has already passed; 50% is the live edge. The
// caller (some deploy orchestrator) supplies headroom as canary health wobbles.
const INITIAL_STAGES: BelayStage[] = [
  { id: "build", label: "build", status: "passed", timestamp: "13:41" },
  { id: "canary", label: "canary", status: "passed", timestamp: "13:52" },
  { id: "10pct", label: "10% cohort", status: "passed", timestamp: "14:02" },
  { id: "50pct", label: "50% cohort", status: "active", timestamp: "14:11" },
  { id: "100pct", label: "100% cohort", status: "pending" },
];

// The 50% cohort clears and 100% goes active — one forward step, staged
// once so the climb and the carabiner-clip flash both actually play. Not a
// loop: the pitch tops out here and just holds, same as a real rollout does
// once it reaches full traffic.
const ADVANCED_STAGES: BelayStage[] = [
  INITIAL_STAGES[0],
  INITIAL_STAGES[1],
  INITIAL_STAGES[2],
  { id: "50pct", label: "50% cohort", status: "passed", timestamp: "14:18" },
  { id: "100pct", label: "100% cohort", status: "active", timestamp: "14:24" },
];

const ADVANCE_AFTER_MS = 2400;

// A scripted headroom trace — canary health margin drifting, dipping close
// to zero (rope pulled taut) before recovering. Not random: reproducible.
const HEADROOM_TRACE = [0.72, 0.61, 0.48, 0.33, 0.19, 0.11, 0.24, 0.4, 0.58, 0.7, 0.66];

export default function RunningBelayDemo() {
  const [stages, setStages] = useState(INITIAL_STAGES);
  const [headroom, setHeadroom] = useState(HEADROOM_TRACE[0]);
  const [lastArrest, setLastArrest] = useState<string | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % HEADROOM_TRACE.length;
      setHeadroom(HEADROOM_TRACE[i]);
    }, 900);
    // Advance the pitch exactly once, monotonically, and stop — this never
    // re-lands on an already-arrested index, so it can't fight a user's
    // arrest by silently clearing `data-belay-state` back to "armed".
    const advance = window.setTimeout(() => setStages(ADVANCED_STAGES), ADVANCE_AFTER_MS);
    return () => {
      clearInterval(t);
      window.clearTimeout(advance);
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / running-belay
        </p>
        <h1 className="text-lg font-semibold text-foreground">Rollout — checkout-service</h1>
        <p className="mt-1 max-w-xs text-sm leading-relaxed text-ns-muted">
          Every passed stage is clipped. The live rope bows with canary
          headroom and pulls taut as it thins. Arrest catches at the last
          healthy cohort — never a step-by-step reverse.
        </p>

        <div className="mt-6 rounded-md border border-border bg-surface p-5">
          <RunningBelay
            stages={stages}
            headroom={headroom}
            ariaLabel="checkout-service rollout"
            onArrest={(id) => setLastArrest(id)}
          />
        </div>

        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          {lastArrest ? `arrested → ${lastArrest}` : "arrest falls back to the last passed cohort"}
        </p>
      </div>
    </main>
  );
}
