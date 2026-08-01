"use client";

import { useState } from "react";
import { MeniscusMeter } from "./component";

// three realistic quota reads at once, chosen so the resting frame already
// shows all three zones side by side — comfortable headroom, tolerated-over
// grace, and an already-spilled seat pool — plus a cycle button that steps
// every value through the same rotation so the curve's concave -> flat ->
// convex -> spill walk (and the one-shot bead + stain) is visible live too.
const STORAGE_STEPS = [55, 90, 40, 96];
const API_STEPS = [88, 60, 95, 40];
const SEATS_STEPS = [103, 55, 80, 65];

export default function MeniscusMeterDemo() {
  const [step, setStep] = useState(0);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / meniscus-meter
        </p>
        <h1 className="text-lg font-semibold text-foreground">Quota vessels</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          The level rises normally under the soft limit — edge concave,
          climbing the walls. At the soft limit it flattens. Past it the
          level pins and the surface bulges convex above the rim instead:
          over budget, still held. Cross the hard limit and a bead breaks
          off, leaving a stain — the crossing itself becomes the record.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 rounded-md border border-border bg-background p-5 sm:grid-cols-3">
          <MeniscusMeter
            label="Storage"
            value={STORAGE_STEPS[step % STORAGE_STEPS.length] ?? 42}
            softLimit={80}
            hardLimit={100}
            unit="%"
          />
          <MeniscusMeter
            label="API budget"
            value={API_STEPS[step % API_STEPS.length] ?? 61}
            softLimit={80}
            hardLimit={100}
            unit="%"
          />
          <MeniscusMeter
            label="Seats"
            value={SEATS_STEPS[step % SEATS_STEPS.length] ?? 70}
            softLimit={80}
            hardLimit={100}
            unit="%"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border px-5 py-3">
          <span className="font-mono text-[11px] text-muted">
            simulate the next billing tick
          </span>
          <button
            type="button"
            data-meniscus-cycle
            onClick={() => setStep((s) => s + 1)}
            className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            NEXT
          </button>
        </div>
      </div>
    </main>
  );
}
