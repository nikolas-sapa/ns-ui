"use client";

import { CurtainAustrianGather } from "./component";

export default function CurtainAustrianGatherDemo() {
  return (
    <main className="relative h-screen w-full overflow-hidden bg-background">
      {/* the destination route the curtain is blocking — a real page mock,
          not a placeholder, so hoisting the drape reveals something */}
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
          ns-ui / curtain-austrian-gather
        </p>
        <h1 className="max-w-lg text-3xl font-medium text-foreground sm:text-4xl">
          The route behind the swags
        </h1>
        <p className="max-w-md text-sm text-ns-muted">
          Hoisting the drape gathers it bottom-up into scalloped swags — click "Skip curtain" to
          hoist it early.
        </p>
      </div>
      <CurtainAustrianGather />
    </main>
  );
}
