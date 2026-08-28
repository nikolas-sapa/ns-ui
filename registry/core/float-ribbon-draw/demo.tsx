"use client";

import { useEffect, useState } from "react";
import { FloatRibbonDraw } from "./component";

const STAGES = ["Queued", "Uploading", "Processing", "Done"];
const STAGE_HOLD_MS = 2600; // per-stage dwell before advancing to the next

export default function FloatRibbonDrawDemo() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => {
      setActiveStage((s) => (s + 1) % STAGES.length);
    }, STAGE_HOLD_MS);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-14 bg-background px-8 py-10">
      <div className="w-full max-w-md">
        <h2 className="mb-3 font-mono text-sm text-foreground">Job pipeline status</h2>
        <p className="mb-6 max-w-prose font-mono text-xs text-ns-muted">
          Fixed stage ticks over a ribbon that never stops drawing — the
          thermal gradient marks the pipeline, the ripple marks that
          material is actively moving through it right now.
        </p>
        <FloatRibbonDraw
          stages={STAGES}
          activeStage={activeStage}
          label={`Job pipeline — ${STAGES[activeStage]}`}
        />
      </div>

      <div className="w-full max-w-md">
        <h2 className="mb-3 font-mono text-sm text-foreground">Ambient, no stages</h2>
        <p className="mb-6 max-w-prose font-mono text-xs text-ns-muted">
          The same ribbon with no stage overlay — a bare processing
          indicator for when there is nothing more specific to report.
        </p>
        <FloatRibbonDraw label="Background sync" />
      </div>
    </div>
  );
}
