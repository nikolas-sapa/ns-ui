"use client";

import { HumpYard } from "./component";

export default function HumpYardDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / view-toggle-rails — every card gets its own rail
      </p>

      <div className="w-full max-w-3xl rounded-md border border-border bg-background p-5">
        <HumpYard />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Switch between List, Grid and Board. Faint rails trace each card's
        exact path between layouts, releasing in reading order like cars cut
        loose over a hump, then fade once their card has docked.
      </p>
    </div>
  );
}
