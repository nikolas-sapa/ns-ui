"use client";

import { useState } from "react";
import { FeelerGap } from "./component";

// three realistic release-gate checks: one comfortably clear, one already
// over, one that starts clear and gets nudged over by the button below —
// so the demo shows both resting states at once and the live transition.
export default function FeelerGapDemo() {
  const [bundle, setBundle] = useState(412);
  const [latency, setLatency] = useState(238);
  const [payload, setPayload] = useState(6.4);

  function recheck() {
    setBundle((v) => (v <= 500 ? 560 : 412));
    setLatency((v) => (v <= 300 ? 340 : 238));
    setPayload((v) => (v <= 10 ? 12.8 : 6.4));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / feeler-gap
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          Release gate checks
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Each check is a blade sized to the live measurement, slid into a
          mouth sized to the limit. Fits through clean and the leftover
          daylight is your margin; too wide and it wedges, compresses, and
          shudders — the overshoot is the part that didn&apos;t fit.
        </p>

        <div className="mt-5 divide-y divide-border rounded-md border border-border bg-surface">
          <div className="p-5">
            <FeelerGap
              label="Bundle size"
              value={bundle}
              limit={500}
              unit="KB"
            />
          </div>
          <div className="p-5">
            <FeelerGap
              label="Response time p95"
              value={latency}
              limit={300}
              unit="ms"
            />
          </div>
          <div className="p-5">
            <FeelerGap
              label="Upload payload"
              value={payload}
              limit={10}
              unit="MB"
            />
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <span className="font-mono text-[11px] text-muted">
              re-run against the latest build
            </span>
            <button
              type="button"
              data-feeler-cycle
              onClick={recheck}
              className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              RE-CHECK
            </button>
          </div>
        </div>

        <p className="mt-3 font-mono text-[11px] text-muted">
          the gap between chip and jaw is the headroom — no red/green badge
          needed to read the margin
        </p>
      </div>
    </main>
  );
}
