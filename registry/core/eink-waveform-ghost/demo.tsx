"use client";

import { EinkWaveformGhost } from "./component";

export default function EinkWaveformGhostDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / eink-waveform-ghost
      </p>
      <EinkWaveformGhost
        title="No documents yet"
        description="Documents you create will show up here."
        ctaLabel="Create a document"
        ctaHref="#"
      />
    </div>
  );
}
