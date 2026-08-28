"use client";

import { FicheStepRepeat } from "./component";

export default function FicheStepRepeatDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / fiche-step-repeat
      </p>
      <div className="aspect-[4/3] w-full max-w-2xl rounded-md border border-border bg-background p-4">
        <FicheStepRepeat reductionRatio={24} />
      </div>
      <p className="max-w-md text-center text-xs text-ns-muted">
        A thumbnail grid populates in strict raster order, one cell per
        exposure flash, then an index strip types in once the sheet is full.
      </p>
    </div>
  );
}
