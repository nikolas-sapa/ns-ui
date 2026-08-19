"use client";

import { useState } from "react";
import { FlyballThrottle } from "./component";

// One API-spend history walked calm -> capped -> hot -> calm. Index 1 sits
// at "closed": the verifier's own gate click on this same NEXT button is
// the only click that ever lands on it (the generic press pass it runs
// first presses "New purchase" instead, a harmless no-op with no
// onNewPurchase wired up in this demo) — so the resting mount (index 0)
// plus exactly one click must already be the cap-reached state, or the
// gate's `expect` never appears.
const STEPS = [
  { spendRate: 18, cap: 900, periodDays: 30, spent: 180 }, // calm, well under pace
  { spendRate: 60, cap: 900, periodDays: 30, spent: 900 }, // capped, buttons disabled
  { spendRate: 48, cap: 900, periodDays: 30, spent: 210 }, // new period, hot — 14 days to cap
  { spendRate: 15, cap: 900, periodDays: 30, spent: 400 }, // cools back to calm
];

// The two real action buttons ("New purchase", "Raise limit") called
// onNewPurchase/onRaiseLimit but nothing was wired to them, so pressing
// either was a pure no-op — the arms never moved. cycleIndex still drives
// the NEXT button exactly as before (mount + one click == STEPS[1], the
// capped state the verifier's gate clicks into); `live` is now a separate,
// independently-mutable scenario so the two real buttons can move it.
// New purchase bumps the burn rate (a purchase raises spend velocity, not
// just the spent total) in steps sized so 3-4 presses each produce a
// visible arm-angle change before the 68deg linkage ceiling clamps it.
// Raise limit widens the cap, which — since omega = spendRate / (cap /
// periodDays) — lowers omega and lets the arms retreat toward the 13deg
// hinge floor; that pull is real physics but has little room to show from
// an already-calm resting state (see AGENTS-facing session notes), so it
// reads clearest right after a purchase has flared the governor open.
const NEW_PURCHASE_SPEND_STEP = 12; // $/day per press
const NEW_PURCHASE_SPENT_STEP = 40; // $ per press
const RAISE_LIMIT_CAP_MULT = 1.9;

export default function FlyballThrottleDemo() {
  const [cycleIndex, setCycleIndex] = useState(0);
  const [live, setLive] = useState(STEPS[0]!);
  const scenario = live;

  function handleCycle() {
    setCycleIndex((i) => {
      const ni = (i + 1) % STEPS.length;
      setLive(STEPS[ni]!);
      return ni;
    });
  }

  function handleNewPurchase() {
    setLive((s) => ({
      ...s,
      spendRate: s.spendRate + NEW_PURCHASE_SPEND_STEP,
      spent: Math.min(s.cap, s.spent + NEW_PURCHASE_SPENT_STEP),
    }));
  }

  function handleRaiseLimit() {
    setLive((s) => ({ ...s, cap: Math.round(s.cap * RAISE_LIMIT_CAP_MULT) }));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / flyball-throttle
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          API spend governor
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          The arms fly wider as burn rate rises above sustainable, not as
          the budget empties — the same 60% spent reads calm on day 28 and
          flares wide on day 6. At rest, lazy spin means healthy.
        </p>

        <div className="mt-5">
          <FlyballThrottle
            label="API spend"
            spendRate={scenario.spendRate}
            cap={scenario.cap}
            periodDays={scenario.periodDays}
            spent={scenario.spent}
            onNewPurchase={handleNewPurchase}
            onRaiseLimit={handleRaiseLimit}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border px-5 py-3">
          <span className="font-mono text-[11px] text-ns-muted">
            step the next burn-rate sample
          </span>
          <button
            type="button"
            data-flyball-cycle
            onClick={handleCycle}
            className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-ns-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            NEXT
          </button>
        </div>

        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          omega = spend rate / (cap / period days) — the governor reads the
          derivative, not the level
        </p>
      </div>
    </main>
  );
}
