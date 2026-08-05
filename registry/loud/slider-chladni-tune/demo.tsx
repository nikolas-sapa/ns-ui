"use client";

import { useState } from "react";
import { ChladniTune } from "./component";

const TARGETS = [63.4, 28.9, 81.2, 47.6];

export default function ChladniTuneDemo() {
  const [seed, setSeed] = useState(0);
  const target = TARGETS[seed % TARGETS.length];
  // start a little off-target (not dead-center of full scatter) so the idle
  // frame reads as a half-formed figure, not uniform noise
  const start = Math.max(0, target - 8);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / slider-chladni-tune — tune by ear, not by number
      </p>

      <div className="w-full max-w-xs rounded-md border border-border bg-surface p-6">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-foreground">Carrier calibration</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ns-muted">
            ch. {(seed % TARGETS.length) + 1}
          </span>
        </div>

        <ChladniTune
          key={seed}
          target={target}
          defaultValue={start}
          min={0}
          max={100}
          step={0.1}
          aria-label="Carrier frequency"
        />

        <p className="mt-5 text-center font-mono text-[11px] text-ns-muted">
          drag the plate into alignment — no number tells you when
        </p>
      </div>

      <button
        type="button"
        onClick={() => setSeed((s) => s + 1)}
        className="rounded-sm border border-border px-4 py-2 font-mono text-xs text-ns-muted transition-colors duration-150 hover:border-ns-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        new reference
      </button>
    </div>
  );
}
