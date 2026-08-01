"use client";

import { ScreePour } from "./component";

export default function ScreePourDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / transition-panel-crumble — the old panel crumbles into the new one
      </p>

      <ScreePour className="h-[440px] w-full max-w-lg" />

      <p className="max-w-md text-center font-mono text-[10px] text-muted">
        view details, then back — matter pours between the two, it never just cuts
      </p>
    </div>
  );
}
