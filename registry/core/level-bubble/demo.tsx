"use client";

import { useState } from "react";
import { LevelBubble } from "./component";

// three targets from three different domains — an SLO burn pace, a
// setpoint, a quota pace — each reading the same way: dead center is on
// target, the ticks are the tolerance band, and the bubble wanders there on
// a lazy spring whenever a fresh reading lands.
export default function LevelBubbleDemo() {
  const [burn, setBurn] = useState(103);
  const [temp, setTemp] = useState(68.4);
  const [pace, setPace] = useState(41.5);

  function pull() {
    setBurn((v) => (v <= 115 ? 148 : 103));
    setTemp((v) => (v <= 69.5 ? 74.8 : 68.4));
    setPace((v) => (v <= 43 ? 27.5 : 41.5));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / level-bubble
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          On target vs off
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Zero is the middle, not the left edge. The bubble eases toward the
          live deviation and rests inside the ticks when in tolerance; push
          it past them and it presses against the capsule end instead of
          flying off the scale.
        </p>

        <div className="mt-5 divide-y divide-border rounded-md border border-border bg-surface">
          <div className="p-5">
            <LevelBubble
              label="Error budget burn"
              value={burn}
              target={100}
              tolerance={15}
              unit="%"
              unitLabel="percent"
            />
          </div>
          <div className="p-5">
            <LevelBubble
              label="Reactor temp"
              value={temp}
              target={68}
              tolerance={1.5}
              unit="°F"
              unitLabel="degrees"
            />
          </div>
          <div className="p-5">
            <LevelBubble
              label="Support pace"
              value={pace}
              target={40}
              tolerance={5}
              unit="/day"
              unitLabel="tickets per day"
            />
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <span className="font-mono text-[11px] text-muted">
              pull a fresh reading
            </span>
            <button
              type="button"
              data-level-bubble-cycle
              onClick={pull}
              className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              PULL READING
            </button>
          </div>
        </div>

        <p className="mt-3 font-mono text-[11px] text-muted">
          the deviation is always printed — the bubble is never the only
          channel
        </p>
      </div>
    </main>
  );
}
