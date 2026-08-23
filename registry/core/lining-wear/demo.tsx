"use client";

import { useEffect, useRef, useState } from "react";
import { LiningWear } from "./component";

const ATTEMPT_DATES = ["Mon 14 Aug", "Thu 17 Aug", "Sun 20 Aug", "Wed 23 Aug"];

// A billing cycle narrated on its own: four charge attempts fail in
// sequence, the subscription pauses, then a successful charge re-lines the
// pad and starts a new cycle — the same way a dunning flow narrates itself
// with no pointer or keyboard input in the loop at all.
const SCRIPT: { attemptsUsed: number; cycle: number; ms: number }[] = [
  { attemptsUsed: 0, cycle: 0, ms: 1400 },
  { attemptsUsed: 1, cycle: 0, ms: 1900 },
  { attemptsUsed: 2, cycle: 0, ms: 1900 },
  { attemptsUsed: 3, cycle: 0, ms: 1900 },
  { attemptsUsed: 4, cycle: 0, ms: 2600 },
  { attemptsUsed: 0, cycle: 1, ms: 2200 },
];

export default function LiningWearDemo() {
  const [step, setStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const current = SCRIPT[step % SCRIPT.length]!;

  useEffect(() => {
    timerRef.current = setTimeout(() => setStep((s) => s + 1), current.ms);
    return () => clearTimeout(timerRef.current);
  }, [step, current.ms]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / lining-wear
      </p>

      <LiningWear
        planName="Pro plan"
        attemptsUsed={current.attemptsUsed}
        attemptDates={ATTEMPT_DATES}
        cycleId={current.cycle}
        onUpdatePayment={() => {}}
      />

      <p className="max-w-sm text-center text-xs text-ns-muted">
        Each failed charge slips the pad sideways and abrades one lamination —
        the scored line stays. A successful charge re-lines the pad and
        retires the old one into the last-cycle well.
      </p>
    </div>
  );
}
