"use client";

import { useEffect, useState } from "react";
import { ProgressNlqOverstrike } from "./component";

export default function ProgressNlqOverstrikeDemo() {
  const [value, setValue] = useState(0);

  // self-driving run: ramps to a mid value and HOLDS there for a couple of
  // seconds before continuing to 100 and holding again — the hold beats are
  // deliberate, not just a pause between ramps. They exist to prove the
  // component's own claim: the strike rhythm at the fill boundary keeps
  // ticking through a beat where `value` genuinely never changes, so any
  // visible difference between screenshots taken during a hold comes from
  // the component's internal rAF clock, not from prop churn. autoplay:
  // none, same reasoning as this suite's other determinate meters — the
  // demo supplies its own value, no synthetic pointer/scroll input needed.
  useEffect(() => {
    let raf = 0;
    const HOLD_A = 62;
    const HOLD_A_MS = 2200;
    const HOLD_B_MS = 1500;
    const RESET_GAP_MS = 500;
    let phase: "toA" | "holdA" | "toB" | "holdB" | "reset" = "toA";
    let phaseStart = performance.now();

    const tick = (now: number) => {
      const elapsed = now - phaseStart;
      if (phase === "toA") {
        const v = Math.min(HOLD_A, elapsed / 18);
        setValue(v);
        if (v >= HOLD_A) {
          phase = "holdA";
          phaseStart = now;
        }
      } else if (phase === "holdA") {
        setValue(HOLD_A);
        if (elapsed >= HOLD_A_MS) {
          phase = "toB";
          phaseStart = now;
        }
      } else if (phase === "toB") {
        const v = Math.min(100, HOLD_A + elapsed / 14);
        setValue(v);
        if (v >= 100) {
          phase = "holdB";
          phaseStart = now;
        }
      } else if (phase === "holdB") {
        setValue(100);
        if (elapsed >= HOLD_B_MS) {
          phase = "reset";
          phaseStart = now;
        }
      } else {
        setValue(0);
        if (elapsed >= RESET_GAP_MS) {
          phase = "toA";
          phaseStart = now;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      data-progress-nlq-card
      className="flex min-h-screen flex-col items-center justify-center gap-10 px-6"
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / progress-nlq-overstrike
      </p>
      <div className="flex w-full max-w-md flex-col gap-8 rounded-xl border border-border bg-surface px-10 py-12">
        <ProgressNlqOverstrike value={value} aria-label="Print job progress" className="h-16 w-full" />
        <ProgressNlqOverstrike
          value={100 - value}
          aria-label="Buffer drain progress"
          className="h-10 w-full"
        />
      </div>
    </div>
  );
}
