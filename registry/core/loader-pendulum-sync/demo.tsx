"use client";

import { useEffect, useRef, useState } from "react";
import { PhaseSwing } from "./component";

// Both cards are fully self-driven (timers only, no pointer/keyboard input)
// so the demo is genuinely ambient — exactly what autoplay:none records.

const PERIOD_MS = 10000;
const RUN_MS = PERIOD_MS + 3400; // a little past one full sync-chaos-sync arc
const DONE_MS = 3200;

export default function PhaseSwingDemo() {
  // Indeterminate card: loops run -> done -> reset, the shape a background
  // indexing job with no progress percentage actually has.
  const [indeterminateDone, setIndeterminateDone] = useState(false);
  useEffect(() => {
    let timer: number;
    let running = true;
    const step = () => {
      timer = window.setTimeout(
        () => {
          running = !running;
          setIndeterminateDone(!running);
          step();
        },
        running ? RUN_MS : DONE_MS
      );
    };
    step();
    return () => window.clearTimeout(timer);
  }, []);

  // Determinate card: value climbs 0->100 over RUN_MS (converging the row
  // to unison right at 100%), holds done, then resets — the JS-driven
  // progress a real build tool would push into `value`.
  const [value, setValue] = useState(0);
  const [determinateDone, setDeterminateDone] = useState(false);
  useEffect(() => {
    let raf: number;
    let phase: "running" | "done" = "running";
    let phaseStart = performance.now();

    const tick = (now: number) => {
      if (phase === "running") {
        const t = Math.min(1, (now - phaseStart) / RUN_MS);
        setValue(Math.round(t * 100));
        if (t >= 1) {
          phase = "done";
          phaseStart = now;
          setDeterminateDone(true);
        }
      } else if (now - phaseStart >= DONE_MS) {
        phase = "running";
        phaseStart = now;
        setDeterminateDone(false);
        setValue(0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-12 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / loader-pendulum-sync
      </p>

      <div className="flex w-full max-w-2xl flex-col gap-8 rounded-xl border border-border bg-surface p-8">
        <div className="flex flex-col items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ns-muted">
            indeterminate — background indexing job
          </span>
          <PhaseSwing
            label="Indexing"
            doneLabel="Indexing complete"
            done={indeterminateDone}
            periodMs={PERIOD_MS}
          />
        </div>

        <div className="h-px w-full bg-border" />

        <div className="flex flex-col items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ns-muted">
            determinate — build converges to unison at 100%
          </span>
          <PhaseSwing
            label="Building"
            doneLabel="Build complete"
            value={value}
            done={determinateDone}
            periodMs={PERIOD_MS}
          />
        </div>
      </div>

      <p className="max-w-md text-center font-mono text-[10px] text-ns-muted">
        sync → chaos → sync every {PERIOD_MS / 1000}s — the realignment is a
        heartbeat, never the finish; done retracts the row and announces
        explicitly
      </p>
    </div>
  );
}
