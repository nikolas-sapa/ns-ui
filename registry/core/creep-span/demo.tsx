"use client";

import { useMemo } from "react";
import { CreepSpan, type DailyBurn } from "./component";

// 28 days of daily burn, oldest -> today, built relative to "now" so the
// narrative ("a spike ~3 weeks back, mild overage lately") reads correctly
// no matter when this demo renders. The two-day spike near the middle is
// the "bad Tuesday": it never leaves the wire even though burn dropped
// straight back to comfortable the next day.
const BURN_SEQUENCE = [
  0.6, 0.5, 0.7, 0.8, 0.6, 0.55, 0.65, 0.7, 0.6, 4.3, 3.6, 0.5, 0.6, 0.55, 0.7,
  0.65, 0.6, 0.7, 0.75, 0.8, 0.7, 0.9, 1.1, 1.2, 1.15, 1.25, 1.3, 1.35,
];

function buildHistory(): DailyBurn[] {
  const today = new Date();
  const n = BURN_SEQUENCE.length;
  return BURN_SEQUENCE.map((burn, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (n - 1 - i));
    return { date: d.toISOString().slice(0, 10), burn };
  });
}

export default function CreepSpanDemo() {
  const history = useMemo(buildHistory, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / creep-span
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          checkout-api error budget
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          The wire never recovers from that spike three weeks back — it stays
          a thick, permanently sagged kink even though burn dropped straight
          back to normal the next day. Scrub the chart or use the arrow keys
          to read any day's budget, burn, and projected exhaustion off the
          exact shape drawn.
        </p>

        <div className="mt-5 rounded-md border border-border p-5">
          <CreepSpan
            label="checkout-api · 30d error budget"
            history={history}
            currentBurn={1.42}
            windowDays={30}
          />
        </div>
      </div>
    </main>
  );
}
