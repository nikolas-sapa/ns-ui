"use client";

import { useEffect, useRef, useState } from "react";
import { SolariFlap } from "./component";

// Fixed 9-char width so the cell count never changes mid-cycle — every
// status is padded/uppercased to line up. The script narrates itself
// with no pointer or keyboard input in the loop, matching pawl-tick's
// self-driving SCRIPT pattern so screenshots always land mid-narrative.
const WIDTH = 9;
const pad = (s: string) => s.toUpperCase().slice(0, WIDTH).padEnd(WIDTH, " ");

const SCRIPT: { value: string; ms: number }[] = [
  { value: pad("BOARDING"), ms: 2600 },
  { value: pad("ON TIME"), ms: 2600 },
  { value: pad("DELAYED"), ms: 2600 },
  { value: pad("GATE B12"), ms: 2600 },
  { value: pad("FINAL CALL"), ms: 2600 },
  { value: pad("DEPARTED"), ms: 2600 },
];

export default function SolariFlapDemo() {
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
        ns-ui / solari-flap
      </p>

      <div className="flex flex-col items-center gap-4 rounded-[16px] border border-border bg-background p-8">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
          Departures — Gate 12
        </span>
        <SolariFlap value={current.value} />
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Hover the board to pause it; hover a single flap to lift it 15° and
        peek the glyph underneath.
      </p>
    </div>
  );
}
