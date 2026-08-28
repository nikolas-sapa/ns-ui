"use client";

import { CmmProbeTouch } from "./component";

export default function CmmProbeTouchDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / cmm-probe-touch</p>

      <CmmProbeTouch />

      <p className="max-w-md text-center text-xs text-ns-muted">
        A probe indexes around the part outline forever — approach, touch, retract, travel —
        while older touched stations fade back into the outline. Hover or focus a station for its
        deviation reading.
      </p>
    </div>
  );
}
