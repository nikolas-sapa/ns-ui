"use client";

import { PneumaticCarrierDispatch } from "./component";

export default function PneumaticCarrierDispatchDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md">
        <p className="mb-8 font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / pneumatic-carrier-dispatch — job queue
        </p>

        <section>
          <p className="mb-4 max-w-sm text-sm leading-relaxed text-ns-muted">
            Three lanes load, launch, and cushion-brake into a shared catch
            tray on their own staggered clocks — a queue that stays visibly
            alive whether or not a real job is in flight.
          </p>

          <PneumaticCarrierDispatch label="EXPORT QUEUE" />
        </section>
      </div>
    </main>
  );
}
