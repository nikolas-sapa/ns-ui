"use client";

import { LaminaDome } from "./component";

// The bottom-anchored full-bleed case: a pre-footer band where the front
// accretes in the lower 40% while the rest of the pane stays clear for
// ordinary copy — nothing here scrims or fights the growth underneath.
export default function LaminaDomeDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <LaminaDome>
        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-start gap-3 px-6 pt-14 text-center sm:pt-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
            ns-ui / lamina-dome
          </p>
          <p className="max-w-sm text-sm text-foreground sm:text-base">
            Domes win light and coarsen from the bottom up — a few tall
            columns shade the rest into stillness, banded every cycle like
            cut rock.
          </p>
        </div>
      </LaminaDome>
    </main>
  );
}
