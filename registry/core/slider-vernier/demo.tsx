"use client";

import { useState } from "react";
import { VernierSlip } from "./component";

// two calibration-bench readings — a dosage and a gain trim — each read the
// caliper way: the coarse row gives the whole units, the sliding vernier row
// below gives the exact last digit at the tick that lines up.
export default function VernierSlipDemo() {
  const [dose, setDose] = useState(1.3);
  const [gain, setGain] = useState(2.4);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / slider-vernier
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          Read the last digit off the vernier
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          Drag the upper half to move fast across the range; drag the sliding
          scale below it to creep one step per tick. The accent tick on the
          bottom row is the fine digit — it lines up with a main tick exactly
          the way a physical caliper reads.
        </p>

        <div className="mt-5 space-y-4">
          <VernierSlip
            label="Dose"
            value={dose}
            onValueChange={setDose}
            min={0}
            max={5}
            step={0.1}
            unit="mg"
          />
          <VernierSlip
            label="Gain trim"
            value={gain}
            onValueChange={setGain}
            min={0}
            max={5}
            step={0.1}
            unit="dB"
          />
        </div>

        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          arrows step ±0.1 · PageUp/Down steps a whole unit · Home/End to the
          rails
        </p>
      </div>
    </main>
  );
}
