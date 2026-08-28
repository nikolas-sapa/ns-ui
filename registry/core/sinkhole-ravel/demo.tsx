"use client";

import { SinkholeRavel } from "./component";

export default function SinkholeRavelDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / sinkhole-ravel</p>

      <div className="w-full max-w-lg">
        <SinkholeRavel className="h-72" onConfirm={() => console.log("confirmed")} />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        A void chimneys upward through the grain field, grain by grain, until the crust over it
        collapses and the crater backfills. Click Trigger collapse to arm — a second click inside
        the window forces the collapse immediately.
      </p>
    </div>
  );
}
