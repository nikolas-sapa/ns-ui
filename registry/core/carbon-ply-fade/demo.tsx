"use client";

import { CarbonPlyFade } from "./component";

export default function CarbonPlyFadeDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / carbon-ply-fade
        </p>
        <div className="rounded-md border border-border bg-surface p-4">
          <CarbonPlyFade aria-label="Recent event copy" />
        </div>
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          each strike echoes down the stack, fainter ply by ply — hover the top card to hold it
        </p>
      </div>
    </main>
  );
}
