"use client";

import { PeenCoverage } from "./component";

export default function PeenCoverageDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / peen-coverage</p>

      <PeenCoverage />

      <p className="max-w-md text-center text-xs text-ns-muted">
        Shot keeps blasting a stippled dimple field toward saturation, resets to a fresh unpeened
        pass, and never stops. Hover the card to dwell the nozzle over one spot.
      </p>
    </div>
  );
}
