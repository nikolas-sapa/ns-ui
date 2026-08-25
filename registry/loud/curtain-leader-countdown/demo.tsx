"use client";

import { CurtainLeaderCountdown } from "./component";

// Display-only autoplay loop — the countdown-and-flash cycle is the
// unconditional idle animation from mount, so the demo needs nothing beyond
// mounting the curtain itself.
export default function CurtainLeaderCountdownDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <CurtainLeaderCountdown />
    </main>
  );
}
