"use client";

import { useEffect, useState } from "react";
import { BlowdownSeat } from "./component";

// A realistic gateway traffic trace walked on a loop. It's ordered so the
// component MOUNTS already past `pop` (900 rps, above the 850 mark) and
// immediately dips to 800 rps — above `reseat` (720) but below `pop` — and
// HOLDS there for several ticks. That's the one frame that proves this is a
// two-threshold valve and not an ordinary single-limit meter: the vent stays
// open even though load has fallen back under the upper mark, because it
// hasn't cleared the lower one yet. Holding it for ~3s means the resting
// screenshot (taken shortly after load) reliably lands on that frame instead
// of on a random point in the cycle. After the hold, the trace finishes
// falling clear of `reseat` (closing the vent), bottoms out, then climbs
// back up to cross `pop` again and loop.
const TRACE = [
  900, 800, 800, 800, 800, 760, 690, 600, 480, 400, 380, 520, 660, 780, 830,
  870,
];

export default function BlowdownSeatDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % TRACE.length), 750);
    return () => clearInterval(id);
  }, []);

  const liveRate = TRACE[step] ?? TRACE[0];

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / blowdown-seat
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          Gateway shed thresholds
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          The disc pops off its seat the instant load crosses the upper
          threshold, then stays lifted through any dip that doesn't clear the
          lower one — drag either handle and watch the other one refuse to
          follow closer than 3 points.
        </p>

        <div className="mt-5 rounded-md border border-border bg-surface p-5">
          <BlowdownSeat
            label="Gateway limiter"
            capacity={1000}
            liveRate={liveRate}
            defaultPop={85}
            defaultReseat={72}
            scaleMax={110}
          />
        </div>

        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          simulated traffic loops on its own — the vent stays open through
          the dip to 800 rps because it never clears the 720 rps reseat mark
        </p>
      </div>
    </main>
  );
}
