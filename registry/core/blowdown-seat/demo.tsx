"use client";

import { useEffect, useState } from "react";
import { BlowdownSeat } from "./component";

// A realistic gateway traffic trace walked on a loop: a climb that crosses
// `pop` (850 rps @ capacity 1000), a dip that stays *above* `reseat` (790
// rps) so the vent must stay open through it, then a fall that finally
// clears `reseat` and reseats. The two-threshold gap is the whole point of
// this component, so the demo has to actually cross it, not just sit near
// one number.
const TRACE = [
  380, 520, 660, 780, 830, 870, 920, 960, 910, 860, 830, 800, 780, 740, 690,
  600, 480, 400,
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
            defaultReseat={79}
          />
        </div>

        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          simulated traffic loops on its own — the vent stays open through
          the dip to 800 rps because it never clears the 790 rps reseat mark
        </p>
      </div>
    </main>
  );
}
