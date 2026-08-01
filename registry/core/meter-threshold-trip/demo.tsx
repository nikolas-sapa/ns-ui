"use client";

import { useState } from "react";
import { BimetalTrip } from "./component";

// a realistic incident-response metric walked through one full trip/re-arm
// cycle: comfortably clear, climbing toward the trip point, tripped and
// latched, then dipping back but not far enough to clear, then finally
// falling below the re-arm mark. The gap between "trips" and "clears" is
// what makes the alert's hysteresis visible instead of implied by color.
const STEPS = [45, 72, 88, 74, 55];

export default function BimetalTripDemo() {
  const [step, setStep] = useState(0);
  const value = STEPS[step % STEPS.length] ?? 45;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / meter-threshold-trip
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          Queue latency alert
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          The strip bows as latency climbs and snaps against the contact the
          instant it trips — then stays latched, unmoved by a value that
          only dips partway back. It only re-arms once latency falls all the
          way below the lower clear mark.
        </p>

        <div className="mt-5 rounded-md border border-border bg-surface p-5">
          <BimetalTrip
            label="p99 latency"
            value={value}
            tripAt={80}
            clearAt={65}
            unit="ms"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border px-5 py-3">
          <span className="font-mono text-[11px] text-muted">
            step the next latency sample
          </span>
          <button
            type="button"
            data-bimetal-cycle
            onClick={() => setStep((s) => s + 1)}
            className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            NEXT
          </button>
        </div>

        <p className="mt-3 font-mono text-[11px] text-muted">
          latched ≠ still over trip — it stays latched until the value clears
          the lower mark, not just drops below the trip point
        </p>
      </div>
    </main>
  );
}
