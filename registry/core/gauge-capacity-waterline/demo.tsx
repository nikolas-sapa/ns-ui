"use client";

import { useEffect, useRef, useState } from "react";
import { PlimsollGauge } from "./component";

const LIMIT = 84;

// Self-driving cargo hold readout: load rises past the legal limit and back
// down, on its own, so a screenshot mid-cycle catches the overload state
// without anyone hovering anything.
const SCRIPT: { value: number; ms: number }[] = [
  { value: 22, ms: 2200 },
  { value: 46, ms: 2200 },
  { value: 68, ms: 2200 },
  { value: 84, ms: 1800 },
  { value: 96, ms: 2600 },
  { value: 112, ms: 2600 },
  { value: 58, ms: 2200 },
];

export default function PlimsollGaugeDemo() {
  const [step, setStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const current = SCRIPT[step % SCRIPT.length]!;

  useEffect(() => {
    timerRef.current = setTimeout(() => setStep((s) => s + 1), current.ms);
    return () => clearTimeout(timerRef.current);
  }, [step, current.ms]);

  const overloaded = current.value > LIMIT;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / gauge-capacity-waterline
      </p>

      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-[16px] border border-border bg-background p-6">
        <div className="flex w-full items-center justify-between">
          <p className="text-sm text-foreground">Hold 3 — Bulk Cargo</p>
          <p className={`font-mono text-xs ${overloaded ? "text-[var(--warning)]" : "text-muted"}`}>
            {Math.round(current.value)}% / {LIMIT}%
          </p>
        </div>

        <PlimsollGauge value={current.value} limit={LIMIT} />

        <p className="text-center text-xs text-muted">
          Hover or focus the hull for an exact sounding; the S mark goes amber
          once the load passes the legal limit.
        </p>
      </div>
    </div>
  );
}
