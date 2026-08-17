"use client";

import { useState } from "react";
import { RemnantCut, type RemnantCutSummary } from "./component";

const CURRENT_PLAN = { id: "pro", name: "Pro", price: 29, periodDays: 31 };
const ELAPSED_DAYS = 22; // 9 days left in the period — the shear lands 71% across the bolt

const CANDIDATES = [
  { id: "team", name: "Team", price: 39, periodDays: 30 },
  { id: "starter", name: "Starter", price: 15, periodDays: 30 },
  { id: "enterprise", name: "Enterprise", price: 79, periodDays: 30 },
];

const TODAY = "2026-08-17";

export default function RemnantCutDemo() {
  const [value, setValue] = useState<string | undefined>(undefined);
  const [confirmed, setConfirmed] = useState<RemnantCutSummary | null>(null);

  function cycle() {
    setConfirmed(null);
    setValue((v) => {
      const idx = v ? CANDIDATES.findIndex((c) => c.id === v) : -1;
      const next = CANDIDATES[(idx + 1) % CANDIDATES.length];
      return next.id;
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">ns-ui / remnant-cut</p>
        <h1 className="text-lg font-semibold text-foreground">Change plan</h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          The used days dim and stay on the old bolt. The unused remnant slides
          across the gutter into whichever plan you pick, re-measured against
          its daily rate — the width you can read off it is the exact day
          count in the figures below, and the sliver at the cut is the cents
          rounding left behind.
        </p>

        <div className="mt-5 rounded-md border border-border bg-background p-5">
          <RemnantCut
            currentPlan={CURRENT_PLAN}
            plans={CANDIDATES}
            elapsedDays={ELAPSED_DAYS}
            today={TODAY}
            value={value}
            onValueChange={(id) => {
              setConfirmed(null);
              setValue(id);
            }}
            onConfirm={(summary) => setConfirmed(summary)}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border px-5 py-3">
          <span className="font-mono text-[11px] text-ns-muted">cycle candidate plan</span>
          <button
            type="button"
            data-remnant-cycle
            onClick={cycle}
            className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-ns-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            NEXT
          </button>
        </div>

        <p aria-live="polite" className="mt-4 min-h-4 text-center font-mono text-[11px] text-ns-muted">
          {confirmed
            ? `confirmed — ${confirmed.creditedAmount.toFixed(2)} credit applied to ${confirmed.planId}`
            : " "}
        </p>
      </div>
    </main>
  );
}
