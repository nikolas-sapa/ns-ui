"use client";

import { SoxhletSiphonCycle } from "./component";

export default function SoxhletSiphonCycleDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / soxhlet-siphon-cycle</p>

      <SoxhletSiphonCycle />

      <p className="max-w-md text-center text-xs text-ns-muted">
        A chamber fills drop by drop for 19.8s, crosses the siphon threshold, and drains in 0.6s — unbounded loop.
      </p>
    </div>
  );
}
