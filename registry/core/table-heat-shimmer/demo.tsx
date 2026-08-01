"use client";

import { useState } from "react";
import { HeatwaveLedger } from "./component";

const THRESHOLDS = [50, 70, 85] as const;

export default function HeatwaveLedgerDemo() {
  const [threshold, setThreshold] = useState<number>(70);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="font-mono text-xs tracking-widest text-muted">
            ns-ui / heatwave-ledger
          </p>
          <div
            role="group"
            aria-label="Heat threshold"
            className="flex items-center gap-2"
          >
            <span className="font-mono text-[11px] tracking-widest text-muted">
              THRESHOLD
            </span>
            <div className="flex overflow-hidden rounded-sm border border-border">
              {THRESHOLDS.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={threshold === t}
                  onClick={() => setThreshold(t)}
                  className={`px-3 py-1.5 font-mono text-[11px] tabular-nums transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                    threshold === t
                      ? "bg-foreground/[0.08] text-foreground"
                      : "text-muted hover:bg-foreground/[0.04] hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <HeatwaveLedger threshold={threshold} />

        <p className="mt-3 font-mono text-[11px] text-muted">
          rows above the threshold shimmer like air over asphalt — hover one and
          it snaps still to read
        </p>
      </div>
    </main>
  );
}
