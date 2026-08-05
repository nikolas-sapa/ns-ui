"use client";

import { useState } from "react";
import { VaporCountdown } from "./component";

const HOUR = 3_600_000;

export default function VaporCountdownDemo() {
  // epoch ms so the prop stays referentially stable between renders
  const [target, setTarget] = useState<number>(() => Date.now() + 26 * HOUR);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-3xl flex-col items-center">
        <p className="mb-10 self-start font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / countdown-vapor-digits
        </p>

        <p className="mb-8 font-mono text-[11px] tracking-[0.25em] text-ns-muted">
          LAUNCH WINDOW CLOSES IN
        </p>

        <VaporCountdown targetDate={target} />

        {/* retargeting swaps every column at once — a full-cloud phase change */}
        <div className="mt-16 flex items-center gap-3">
          {(
            [
              ["T-24H", 24 * HOUR],
              ["T-1H", HOUR],
              ["T-90S", 90_000],
            ] as const
          ).map(([label, offset]) => (
            <button
              key={label}
              type="button"
              onClick={() => setTarget(Date.now() + offset)}
              className="rounded-sm border border-border px-4 py-1.5 font-mono text-[11px] tracking-widest text-ns-muted transition-colors duration-200 hover:border-white/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-4 font-mono text-[11px] text-ns-muted">
          retarget to watch every digit sublimate and condense at once
        </p>
      </div>
    </main>
  );
}
