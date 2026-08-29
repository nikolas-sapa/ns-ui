"use client";

import { TonerFuseStreak } from "./component";

// Self-driving: no props to toggle, the print cycle loops on its own clock.
// Passes real DOM as the shape source — a headline, two paragraph lines and
// a media block — so the silhouette a viewer sees is this exact layout, not
// the built-in placeholder.
export default function TonerFuseStreakDemo() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-8 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / toner-fuse-streak
      </p>

      <div data-toner-fuse-streak-stage className="w-full max-w-md overflow-hidden rounded-lg border border-border">
        <TonerFuseStreak>
          <div className="p-6">
            <h3 className="text-lg font-semibold">Quarterly report</h3>
            <p className="mt-2 text-sm">
              Revenue held steady across every region this quarter, with the
              largest gains coming from the enterprise tier.
            </p>
            <div className="mt-4 h-28 w-full rounded-md bg-ns-muted" />
          </div>
        </TonerFuseStreak>
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Charge, then a top-to-bottom expose/develop wipe — watch the toner
        catch behind the line, thin at fine edges for 400ms, and leave a
        persistent streak in the trailing edge of the media block.
      </p>
    </div>
  );
}
