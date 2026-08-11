"use client";

import { WeirCrest } from "./component";

// The resting frame is deliberately mid-reservoir: the Starter dam is already
// overtopped and pouring, Growth is standing dry a little above the line, and
// Scale is dry to its crest — so the mechanism reads before anyone touches it.
export default function WeirCrestDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <WeirCrest />
    </main>
  );
}
