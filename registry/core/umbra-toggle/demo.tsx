"use client";

import { useEffect, useRef, useState } from "react";
import { UmbraToggle } from "./component";

// Self-driving: flips the switch on a timer so the eclipse, corona and
// ambient tint all get exercised without any pointer/keyboard input.
const SCRIPT: { checked: boolean; ms: number }[] = [
  { checked: false, ms: 1400 },
  { checked: true, ms: 2200 },
  { checked: false, ms: 1800 },
  { checked: true, ms: 2200 },
];

export default function UmbraToggleDemo() {
  const [step, setStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const current = SCRIPT[step % SCRIPT.length]!;

  useEffect(() => {
    timerRef.current = setTimeout(() => setStep((s) => s + 1), current.ms);
    return () => clearTimeout(timerRef.current);
  }, [step, current.ms]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / umbra-toggle
      </p>

      <div className="flex flex-col items-center gap-6 rounded-[12px] border border-border bg-background px-10 py-10">
        <UmbraToggle checked={current.checked} onCheckedChange={() => {}} />
        <p className="max-w-xs text-center text-xs text-muted">
          A dark disc eclipses a bright one — the crescent and corona are
          computed geometry, not sprite frames.
        </p>
      </div>
    </div>
  );
}
