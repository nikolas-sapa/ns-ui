"use client";

import { ShakeoutCrumble } from "./component";

// A small saved-items panel with a destructive "Clear all" surface below it.
// The mould shakes itself out on an unforced ~7s loop even with no input —
// that ambient cycle IS the rehearsal of what a real confirm does. Click (or
// Space/Enter) once to arm it, watch the vibration intensify as the window
// ticks down, then click again to commit — or let it expire, or press
// Escape, and the sand reclaims itself back over the casting.
export default function ShakeoutCrumbleDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / shakeout-crumble
      </p>

      <div className="w-full max-w-sm rounded-[12px] border border-border bg-background px-6 py-5">
        <p className="text-sm font-medium text-foreground">Saved snapshots</p>
        <div className="mt-3 flex flex-col gap-2" aria-hidden="true">
          <span className="h-2.5 w-full rounded-full bg-border" />
          <span className="h-2.5 w-11/12 rounded-full bg-border" />
          <span className="h-2.5 w-4/5 rounded-full bg-border" />
        </div>

        <div className="mt-5">
          <ShakeoutCrumble onConfirm={() => {}} />
        </div>
      </div>

      <p className="max-w-sm text-center text-xs text-ns-muted">
        First activation arms the shakeout; a second lands it. De-arm by
        waiting out the window, pressing Escape, or moving focus away.
      </p>
    </div>
  );
}
