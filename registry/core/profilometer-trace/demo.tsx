"use client";

import { ProfilometerTrace } from "./component";

export default function ProfilometerTraceDemo() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-10 bg-background px-8 py-10">
      <div className="w-full max-w-3xl">
        <h2 className="mb-3 font-mono text-sm text-foreground">Section one</h2>
        <p className="mb-8 max-w-prose font-mono text-xs text-ns-muted">
          A contact profilometer stylus fixed near the right edge, the
          measured surface's roughness-plus-waviness trace scrolling
          continuously beneath it, right to left, forever.
        </p>
        <ProfilometerTrace />
      </div>
      <div className="w-full max-w-3xl">
        <h2 className="mt-8 font-mono text-sm text-foreground">Section two</h2>
      </div>
    </div>
  );
}
