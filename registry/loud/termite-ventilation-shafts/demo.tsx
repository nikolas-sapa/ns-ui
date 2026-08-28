"use client";

import { TermiteVentilationShafts } from "./component";

// The network is already built and mid-cycle by the time anything paints —
// there is no growth to watch, only the slow fill/particle direction of a
// fixed conduit system rising and falling with the 42s diurnal clock.
export default function TermiteVentilationShaftsDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <TermiteVentilationShafts>
        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / termite-ventilation-shafts
            </p>
            <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              A mound that breathes
            </h1>
            <p className="max-w-sm text-sm text-ns-muted">
              The shafts were dug once. What moves through them now is only the day&apos;s heat,
              rising out, cooling, and sinking back in.
            </p>
          </div>
        </div>
      </TermiteVentilationShafts>
    </main>
  );
}
