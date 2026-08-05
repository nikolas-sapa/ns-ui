"use client";

import { useEffect, useRef, useState } from "react";
import { GnomonSet } from "./component";

// Self-driving loop through a handful of times of day so the screenshot
// pass catches both a short AM shadow and a long PM one.
const SCRIPT: { hour: number; minute: number }[] = [
  { hour: 9, minute: 0 },
  { hour: 11, minute: 30 },
  { hour: 14, minute: 15 },
  { hour: 19, minute: 45 },
];

export default function GnomonSetDemo() {
  const [step, setStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const current = SCRIPT[step % SCRIPT.length]!;

  useEffect(() => {
    timerRef.current = setTimeout(() => setStep((s) => s + 1), 2600);
    return () => clearTimeout(timerRef.current);
  }, [step]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / time-picker-sundial
      </p>

      <div className="flex flex-col items-center rounded-[12px] border border-border bg-background p-8">
        <GnomonSet hour={current.hour} minute={current.minute} />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Drag the outer ring for the hour, the inner ring for 5-minute
        detents. Keep dragging past 12 and the shadow lengthens into PM.
      </p>
    </div>
  );
}
