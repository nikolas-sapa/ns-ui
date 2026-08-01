"use client";

import { useState } from "react";
import { RationRule } from "./component";

// a settings-page workspace panel: the kind of screen where a quota meter
// like this appears half a dozen times, quietly, at text scale — no bars,
// no pills, just the number and a rule underneath it.
export default function RationRuleDemo() {
  const [storage, setStorage] = useState(38.2);
  const [seats, setSeats] = useState(14);
  const [credits, setCredits] = useState(4200);
  const [budget, setBudget] = useState(2150);

  function simulateUsage() {
    setStorage((v) => (v <= 60 ? 92.4 : 38.2));
    setSeats((v) => (v <= 16 ? 19 : 14));
    setCredits((v) => (v <= 4500 ? 4820 : 4200));
    setBudget((v) => (v <= 3000 ? 4680 : 2150));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / ration-rule
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          Workspace usage
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Every allowance on this page reads the same way: the number, then
          the rule underneath it. Used ground is solid, remaining ground is
          dashed, and a tick marks the warning line — crossing it thickens
          the rule and bolds the digits, never turns them red.
        </p>

        <div className="mt-5 divide-y divide-border rounded-md border border-border bg-surface">
          <div className="p-5">
            <RationRule
              label="Storage"
              value={storage}
              max={100}
              unit="GB"
              unitLabel="gigabytes"
            />
          </div>
          <div className="p-5">
            <RationRule
              label="Seats"
              value={seats}
              max={20}
              unit="seats"
              unitLabel="seats"
            />
          </div>
          <div className="p-5">
            <RationRule
              label="API credits"
              value={credits}
              max={5000}
              unit="req"
              unitLabel="requests"
            />
          </div>
          <div className="p-5">
            <RationRule
              label="Monthly budget"
              value={budget}
              max={5000}
              unit="$"
              unitLabel="dollars"
              warning={0.85}
            />
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <span className="font-mono text-[11px] text-muted">
              advance the billing period
            </span>
            <button
              type="button"
              data-ration-cycle
              onClick={simulateUsage}
              className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              SIMULATE USAGE
            </button>
          </div>
        </div>

        <p className="mt-3 font-mono text-[11px] text-muted">
          the printed numbers are the whole reading — the rule is a footnote
          to them, not the other way around
        </p>
      </div>
    </main>
  );
}
