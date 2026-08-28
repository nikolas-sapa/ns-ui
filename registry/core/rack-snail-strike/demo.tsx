"use client";

import { RackSnailStrike } from "./component";

export default function RackSnailStrikeDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / rack-snail-strike</p>

      <RackSnailStrike label="resolved this hour" />

      <p className="max-w-md text-center text-xs text-ns-muted">
        A cam selects how far the rack falls, then it climbs back one tooth per strike — the fall depth IS the count,
        the number is just the read-out. Idle demo cadence, compressed from a real once-per-hour event.
      </p>
    </div>
  );
}
