"use client";

import { RoastFirstCrack } from "./component";

// The drum is already turning before anything is touched — beans tumble,
// cascade past their repose angle, and pop with a fissure and a curling
// chaff peel on their own, forever. No interaction: this is an ambient
// "in progress" backdrop, not a control surface.
export default function RoastFirstCrackDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <RoastFirstCrack>
        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / roast-first-crack
            </p>
            <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              We&apos;re preparing your account.
            </h1>
            <p className="max-w-sm text-sm text-ns-muted">
              Beans tumble, crack, and settle back into the drum — first
              crack never stops while this runs.
            </p>
          </div>
        </div>
      </RoastFirstCrack>
    </main>
  );
}
